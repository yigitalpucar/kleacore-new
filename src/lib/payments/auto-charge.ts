/**
 * Daily automatic collection (Faz 3.7) — docs/payments-saved-cards.md.
 *
 * For customers with auto-pay on and a usable default card, every unpaid
 * invoice (PENDING / OVERDUE) that is due today or still inside the grace
 * window is charged once per day, at most `auto_charge_max_attempts` times in
 * total. The PaymentAttempt key "auto:<invoiceId>:<local date>" is unique, so
 * a second run on the same day (retry, overlapping container) can never charge
 * twice. Runs from /api/cron/auto-charge under the cron advisory lock.
 */
import type { PaymentAttempt, SavedCard } from "@prisma/client";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { createLogger } from "@/lib/logger";
import { sendNotification } from "@/lib/notifications/send";
import {
  cardExpiresAt,
  chargeInvoiceWithSavedCard,
  getSavedCardAvailability,
  isCardExpired,
  promoteNextDefault,
  savedCardLabel,
} from "@/lib/payments/saved-cards";

const log = createLogger("payments.auto-charge");

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRY_NOTICE_DAYS = 30;
const BATCH_LIMIT = 500;

function timezone() {
  return process.env.CRON_TIMEZONE || "Europe/Istanbul";
}

/** YYYY-MM-DD in the business timezone. */
export function localDateKey(date: Date, tz = timezone()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(date);
}

/** UTC instant of local midnight starting the day that contains `date`. */
export function startOfLocalDay(date: Date, tz = timezone()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = asUtc - Math.floor(date.getTime() / 1000) * 1000;
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day) - offset);
}

export function autoChargeKey(invoiceId: string, now: Date) {
  return `auto:${invoiceId}:${localDateKey(now)}`;
}

export interface AutoChargeSummary {
  processed: number;
  charged: number;
  failed: number;
  pending: number;
  skipped: number;
  skippedReasons: Record<string, number>;
  expiryNotices: number;
  expiredCards: number;
  disabled?: string;
  ids: string[];
}

type FailedAttempt = Pick<PaymentAttempt, "id" | "invoiceId" | "userId" | "savedCardId" | "amount" | "errorMessage" | "kind">;

/**
 * "Kartınızdan tahsilat yapılamadı" + payment.failed event, once per attempt
 * (dedupe key). Used by the daily job and by the PayTR notification route when
 * a pending auto-charge is declined later.
 */
export async function notifyAutoChargeFailure(attempt: FailedAttempt, maxAttempts?: number) {
  const [invoice, card, attemptNumber, settings] = await Promise.all([
    db.invoice.findUnique({ where: { id: attempt.invoiceId }, select: { invoiceNumber: true, dueDate: true } }),
    attempt.savedCardId ? db.savedCard.findUnique({ where: { id: attempt.savedCardId } }) : null,
    db.paymentAttempt.count({ where: { invoiceId: attempt.invoiceId, kind: "AUTO" } }),
    maxAttempts ? null : getSavedCardAvailability().then((availability) => availability.settings),
  ]);
  if (!invoice) return;
  const limit = maxAttempts ?? settings?.maxAttempts ?? 3;

  // The customer mail (billing.auto-charge-failed, once per attempt) and
  // the staff alert are sent by the event subscribers.
  await db.$transaction(async (tx) => {
    await emitEvent(tx, "payment.failed", {
      invoiceId: attempt.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      customerId: attempt.userId,
      amount: String(attempt.amount),
      gateway: "paytr",
      automatic: attempt.kind === "AUTO",
      attemptId: attempt.id,
      card: card ? savedCardLabel(card) : "Kayıtlı kart",
      attempt: Math.min(attemptNumber, limit),
      maxAttempts: limit,
      dueDate: invoice.dueDate,
      reason: attempt.errorMessage ?? undefined,
    });
  });
}

async function processExpiringCards(now: Date) {
  const horizon = new Date(now.getTime() + EXPIRY_NOTICE_DAYS * DAY_MS);
  const cards = await db.savedCard.findMany({
    where: {
      status: "ACTIVE",
      expYear: { not: null, lte: horizon.getUTCFullYear() },
    },
    include: { user: { select: { autoPayEnabled: true } } },
  });

  let notices = 0;
  let expired = 0;
  for (const card of cards) {
    const expiresAt = cardExpiresAt(card);
    if (!expiresAt) continue;

    if (isCardExpired(card, now)) {
      await db.$transaction(async (tx) => {
        await tx.savedCard.update({ where: { id: card.id }, data: { status: "EXPIRED", isDefault: false } });
        if (card.isDefault) await promoteNextDefault(tx, card.userId);
      });
      expired += 1;
      continue;
    }

    if (expiresAt.getTime() <= horizon.getTime() && !card.expiryNoticeSentAt) {
      await db.$transaction(async (tx) => {
        await sendNotification({
          tx,
          userId: card.userId,
          template: "billing.card-expiring",
          data: { card: savedCardLabel(card), expiresAt, autoPay: card.user.autoPayEnabled && card.isDefault },
          dedupeKey: `card.expiring:${card.id}`,
        });
        await tx.savedCard.update({ where: { id: card.id }, data: { expiryNoticeSentAt: now } });
      });
      notices += 1;
    }
  }
  return { notices, expired };
}

export async function runAutoCharge(now = new Date()): Promise<AutoChargeSummary> {
  const summary: AutoChargeSummary = {
    processed: 0,
    charged: 0,
    failed: 0,
    pending: 0,
    skipped: 0,
    skippedReasons: {},
    expiryNotices: 0,
    expiredCards: 0,
    ids: [],
  };
  const skip = (reason: string) => {
    summary.skipped += 1;
    summary.skippedReasons[reason] = (summary.skippedReasons[reason] ?? 0) + 1;
  };

  // Expiry first, so an expired default is replaced before charging.
  const expiry = await processExpiringCards(now);
  summary.expiryNotices = expiry.notices;
  summary.expiredCards = expiry.expired;

  const availability = await getSavedCardAvailability();
  if (!availability.available) {
    summary.disabled = availability.reason;
    return summary;
  }
  const { maxAttempts, graceDays } = availability.settings;

  const today = startOfLocalDay(now);
  const dueBefore = new Date(today.getTime() + DAY_MS);
  const dueFrom = new Date(today.getTime() - graceDays * DAY_MS);

  const invoices = await db.invoice.findMany({
    where: {
      status: { in: ["PENDING", "OVERDUE"] },
      dueDate: { gte: dueFrom, lt: dueBefore },
      customer: { autoPayEnabled: true },
      bankTransferNotices: { none: { status: "PENDING" } },
    },
    select: { id: true, customerId: true },
    orderBy: { dueDate: "asc" },
    take: BATCH_LIMIT,
  });

  const defaultCards = new Map<string, SavedCard | null>();
  for (const invoice of invoices) {
    summary.processed += 1;

    const attempts = await db.paymentAttempt.findMany({
      where: { invoiceId: invoice.id, kind: "AUTO" },
      select: { status: true },
    });
    if (attempts.some((attempt) => attempt.status === "PENDING" || attempt.status === "UNKNOWN")) {
      skip("in-flight");
      continue;
    }
    if (attempts.length >= maxAttempts) {
      skip("max-attempts");
      continue;
    }

    if (!defaultCards.has(invoice.customerId)) {
      defaultCards.set(
        invoice.customerId,
        await db.savedCard.findFirst({ where: { userId: invoice.customerId, status: "ACTIVE", isDefault: true } })
      );
    }
    const card = defaultCards.get(invoice.customerId);
    if (!card) {
      skip("no-default-card");
      continue;
    }

    let result: Awaited<ReturnType<typeof chargeInvoiceWithSavedCard>>;
    try {
      result = await chargeInvoiceWithSavedCard({
        invoiceId: invoice.id,
        cardId: card.id,
        kind: "AUTO",
        idempotencyKey: autoChargeKey(invoice.id, now),
      });
    } catch (error) {
      // One broken invoice must not stop the batch; its attempt (if any)
      // stays open and blocks a blind re-charge until the gateway settles it.
      log.error("auto-charge failed for invoice", { invoiceId: invoice.id, error });
      skip("error");
      continue;
    }

    switch (result.status) {
      case "succeeded":
        summary.charged += 1;
        summary.ids.push(invoice.id);
        break;
      case "failed": {
        summary.failed += 1;
        const attempt = await db.paymentAttempt.findUnique({ where: { id: result.attemptId } });
        if (attempt) {
          try {
            await notifyAutoChargeFailure(attempt, maxAttempts);
          } catch (error) {
            log.error("auto-charge failure notification failed", { attemptId: attempt.id, error });
          }
        }
        break;
      }
      case "pending":
        summary.pending += 1;
        break;
      case "duplicate":
        skip("already-attempted-today");
        break;
      case "skipped":
        skip(result.reason);
        break;
    }
  }

  log.info("auto-charge finished", { ...summary, ids: summary.ids.length });
  return summary;
}
