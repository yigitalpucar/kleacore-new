import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { isZero } from "@/lib/money";
import { sendNotification } from "./send";

const log = createLogger("notifications.billing");

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** "Fatura oluştu" catches invoices created in this window that weren't announced at creation. */
const CREATED_LOOKBACK_MS = 2 * DAY_MS;
/** "Vade -3 gün" reminder window. */
export const REMINDER_DAYS_BEFORE_DUE = 3;
/** Overdue catch-up (status set outside the overdue cron). */
const OVERDUE_LOOKBACK_MS = 3 * DAY_MS;

/** Idempotency keys: one notice per invoice per type, ever. */
export const invoiceNoticeKey = {
  created: (invoiceId: string) => `invoice.created:${invoiceId}`,
  reminder: (invoiceId: string) => `invoice.reminder:${invoiceId}`,
  overdue: (invoiceId: string) => `invoice.overdue:${invoiceId}`,
};

type NoticeType = keyof typeof invoiceNoticeKey;

const TEMPLATE_BY_TYPE = {
  created: "billing.invoice-created",
  reminder: "billing.invoice-reminder",
  overdue: "billing.invoice-overdue",
} as const;

const invoiceSelect = {
  id: true,
  invoiceNumber: true,
  customerId: true,
  totalAmount: true,
  dueDate: true,
} satisfies Prisma.InvoiceSelect;

type NoticeInvoice = Prisma.InvoiceGetPayload<{ select: typeof invoiceSelect }>;

async function alreadyNotified(keys: string[]) {
  if (keys.length === 0) return new Set<string>();
  const rows = await db.notificationLog.findMany({
    where: { dedupeKey: { in: keys } },
    select: { dedupeKey: true },
  });
  return new Set(rows.map((row) => row.dedupeKey));
}

async function sendNotices(type: NoticeType, invoices: NoticeInvoice[], now: Date, extra: Record<string, unknown> = {}) {
  const candidates = invoices.filter((invoice) => !isZero(invoice.totalAmount));
  const done = await alreadyNotified(candidates.map((invoice) => invoiceNoticeKey[type](invoice.id)));
  const sent: string[] = [];

  for (const invoice of candidates) {
    const dedupeKey = invoiceNoticeKey[type](invoice.id);
    if (done.has(dedupeKey)) continue;

    const daysLeft = Math.max(0, Math.ceil((invoice.dueDate.getTime() - now.getTime()) / DAY_MS));
    const result = await sendNotification({
      userId: invoice.customerId,
      template: TEMPLATE_BY_TYPE[type],
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount.toString(),
        dueDate: invoice.dueDate,
        ...(type === "reminder" ? { daysLeft } : {}),
        ...extra,
      },
      dedupeKey,
    });
    if (result.logIds.length > 0) sent.push(invoice.id);
  }

  return sent;
}

/**
 * "Gecikti" notice for invoices the overdue cron just flipped to OVERDUE.
 * Replaces the old SMS-only notice; e-mail always, SMS when configured.
 */
export async function notifyOverdueInvoices(invoiceIds: string[], now = new Date()) {
  if (invoiceIds.length === 0) return 0;
  const invoices = await db.invoice.findMany({
    where: { id: { in: invoiceIds }, status: "OVERDUE" },
    select: invoiceSelect,
  });
  const { getSuspendGraceDays } = await import("@/lib/cron/jobs/suspend-overdue-services");
  const sent = await sendNotices("overdue", invoices, now, { suspendAfterDays: await getSuspendGraceDays() });
  return sent.length;
}

/**
 * Hourly sweep ("notifications" cron), idempotent per invoice and type:
 * - created: PENDING invoices from the last 48h that belong to a renewal
 *   (order with a service) or have no order (admin-created). Checkout
 *   invoices are covered by "sipariş alındı" and skipped.
 * - reminder: PENDING invoices due within 3 days, unless created in the last 24h.
 * - overdue: OVERDUE invoices due in the last 3 days that got no notice yet.
 */
export async function sendInvoiceNotices(now = new Date()) {
  const [created, reminders, overdue] = await Promise.all([
    db.invoice.findMany({
      where: {
        status: "PENDING",
        createdAt: { gte: new Date(now.getTime() - CREATED_LOOKBACK_MS) },
        OR: [{ orderId: null }, { order: { serviceId: { not: null } } }],
      },
      select: invoiceSelect,
      take: 500,
    }),
    db.invoice.findMany({
      where: {
        status: "PENDING",
        dueDate: { gt: now, lte: new Date(now.getTime() + REMINDER_DAYS_BEFORE_DUE * DAY_MS) },
        createdAt: { lt: new Date(now.getTime() - DAY_MS) },
      },
      select: invoiceSelect,
      take: 500,
    }),
    db.invoice.findMany({
      where: {
        status: "OVERDUE",
        dueDate: { gte: new Date(now.getTime() - OVERDUE_LOOKBACK_MS), lt: now },
      },
      select: { id: true },
      take: 500,
    }),
  ]);

  // An invoice announced as "created" in this run doesn't also get the
  // reminder on top; the next run (an hour later) sends it.
  const createdNow = await sendNotices("created", created, now);
  const remindersNow = await sendNotices(
    "reminder",
    reminders.filter((invoice) => !createdNow.includes(invoice.id)),
    now
  );
  const result = {
    created: createdNow.length,
    reminders: remindersNow.length,
    overdue: await notifyOverdueInvoices(overdue.map((invoice) => invoice.id), now),
  };
  log.info("invoice notices queued", result);
  return result;
}
