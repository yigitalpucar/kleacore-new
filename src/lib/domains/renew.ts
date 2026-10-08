import type { DomainRenewal } from "@prisma/client";
import type { PrismaTransactionLike } from "pg-boss";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { enqueue } from "@/lib/jobs/enqueue";
import { getBoss } from "@/lib/jobs/boss";
import { DOMAIN_RENEW_JOB } from "@/lib/jobs/definitions";
import type { JobContext } from "@/lib/jobs/registry";
import {
  getDomainInfoFromRegistrar,
  renewDomainWithRegistrar,
} from "@/lib/integrations/registrar";
import { sendNotification } from "@/lib/notifications/send";
import { formatDate } from "@/lib/format/date";
import { addYears, DAY_MS, domainLog, recordDomainEvent, type DbClient } from "./lifecycle";

/**
 * Registrar renew after a renewal invoice is paid (roadmap 1.2).
 *
 *   invoice PAID ──(fulfillInvoicePayment, same tx)──▶ onDomainRenewalPaid
 *     renewal PENDING → PAID, domain.renew job enqueued with the tx (outbox)
 *   domain.renew (pg-boss, 5 attempts with backoff) ──▶ runDomainRenewal
 *     registrar renew → expiresAt += years → COMPLETED
 *     final failure → FAILED + admin notification (job stays failed in İşler)
 */

const BOSS_READY_TIMEOUT_MS = 2_000;
const STALE_PROCESSING_MS = 15 * 60 * 1000;
/** Registrar expiry within this much of the target counts as "already renewed". */
const RENEWED_TOLERANCE_MS = 2 * DAY_MS;

type RenewalWithDomain = DomainRenewal & {
  domain: { id: string; name: string; customerId: string; expiresAt: Date; status: string };
};

async function bossReady(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      getBoss(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("pg-boss start timed out")), BOSS_READY_TIMEOUT_MS);
      }),
    ]);
    return true;
  } catch (error) {
    domainLog.error("job queue unavailable; domain renewal left for the domain-renewals cron", { error });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Schedules the registrar renew of a PAID renewal. Never fails the caller's
 * transaction for a queue outage: the row stays PAID and the daily
 * domain-renewals cron (`reconcileDomainRenewals`) enqueues it later.
 * Idempotent per renewal (exclusive queue, singletonKey = renewal id).
 */
export async function queueDomainRenewal(client: PrismaTransactionLike, renewalId: string) {
  if (!(await bossReady())) return { queued: false as const };
  const result = await enqueue(DOMAIN_RENEW_JOB, { renewalId }, { singletonKey: renewalId, tx: client });
  return { queued: !result.deduplicated };
}

/**
 * Fulfilment hook: the invoice became PAID. If it is a domain renewal invoice,
 * marks the renewal PAID and enqueues the registrar renew. Pass the payment
 * transaction so the job commits (or rolls back) with the payment.
 * No-op for any other invoice.
 */
export async function onDomainRenewalPaid(invoiceId: string, client: DbClient = db) {
  const renewal = await client.domainRenewal.findUnique({
    where: { invoiceId },
    select: { id: true, domainId: true, years: true },
  });
  if (!renewal) return { queued: false as const, renewalId: null };

  const marked = await client.domainRenewal.updateMany({
    where: { id: renewal.id, status: { in: ["PENDING", "CANCELLED"] } },
    data: { status: "PAID", lastError: null },
  });
  if (marked.count === 0) return { queued: false as const, renewalId: renewal.id };

  await recordDomainEvent(
    {
      domainId: renewal.domainId,
      type: "renewal.paid",
      message: `Yenileme faturası ödendi; registrar yenilemesi kuyruğa alındı (${renewal.years} yıl)`,
      details: { invoiceId, renewalId: renewal.id },
    },
    client
  );

  const { queued } = await queueDomainRenewal(client, renewal.id);
  return { queued, renewalId: renewal.id };
}

type AttemptResult =
  | { ok: true; registrarExpiresAt: Date | null; alreadyRenewed: boolean }
  | { ok: false; error: string };

async function attemptRegistrarRenew(renewal: RenewalWithDomain): Promise<AttemptResult> {
  const target = addYears(renewal.periodStart, renewal.years);

  // Already extended past this period (registrar-side auto renew picked up by
  // the sync, or a manual renew): don't renew a second time.
  if (renewal.domain.expiresAt.getTime() >= target.getTime() - RENEWED_TOLERANCE_MS) {
    return { ok: true, registrarExpiresAt: renewal.domain.expiresAt, alreadyRenewed: true };
  }

  // A retry after an attempt whose registrar call may have gone through
  // (timeout, crash before our DB write): renewing again would add a second
  // year. Ask the registrar first when it can tell us.
  if (renewal.attempts > 0) {
    const info = await getDomainInfoFromRegistrar(renewal.domain.name).catch(() => null);
    const expiresAt = info?.ok ? info.data?.expiresAt : null;
    if (expiresAt && expiresAt.getTime() >= target.getTime() - RENEWED_TOLERANCE_MS) {
      return { ok: true, registrarExpiresAt: expiresAt, alreadyRenewed: true };
    }
  }

  try {
    const result = await renewDomainWithRegistrar({ domain: renewal.domain.name, years: renewal.years });
    if (result.ok && !result.skipped) {
      return { ok: true, registrarExpiresAt: result.data?.expiresAt ?? null, alreadyRenewed: false };
    }
    // A disabled registrar renewed nothing: that is a failure, not a success.
    return {
      ok: false,
      error: result.error ?? (result.skipped ? "REGISTRAR_NOT_CONFIGURED" : "REGISTRAR_RENEW_FAILED"),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "REGISTRAR_RENEW_FAILED" };
  }
}

/** New expiry: the registrar's when it reports a later one, else periodStart + years. */
export function resolveNewExpiry(periodStart: Date, years: number, registrarExpiresAt: Date | null) {
  const computed = addYears(periodStart, years);
  if (registrarExpiresAt && registrarExpiresAt.getTime() > periodStart.getTime()) {
    return registrarExpiresAt;
  }
  return computed;
}

async function completeRenewal(
  renewal: RenewalWithDomain,
  attempt: Extract<AttemptResult, { ok: true }>,
  actorId: string | null
) {
  const newExpiresAt = resolveNewExpiry(renewal.periodStart, renewal.years, attempt.registrarExpiresAt);
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.domainRenewal.update({
      where: { id: renewal.id },
      data: {
        status: "COMPLETED",
        attempts: { increment: 1 },
        lastError: null,
        newExpiresAt,
        renewedAt: now,
      },
    });

    // Never move expiry backwards (a sync may already have moved it further).
    await tx.domain.updateMany({
      where: { id: renewal.domainId, expiresAt: { lt: newExpiresAt } },
      data: { expiresAt: newExpiresAt },
    });
    await tx.domain.updateMany({
      where: { id: renewal.domainId, status: "EXPIRED" },
      data: { status: "ACTIVE" },
    });

    await recordDomainEvent(
      {
        domainId: renewal.domainId,
        type: "renewal.completed",
        message: attempt.alreadyRenewed
          ? `Registrar'da zaten yenilenmiş bulundu; yeni bitiş ${formatDate(newExpiresAt)}`
          : `Registrar'da ${renewal.years} yıl yenilendi; yeni bitiş ${formatDate(newExpiresAt)}`,
        details: {
          renewalId: renewal.id,
          previousExpiresAt: renewal.domain.expiresAt.toISOString(),
          newExpiresAt: newExpiresAt.toISOString(),
          registrarReportedExpiry: attempt.registrarExpiresAt?.toISOString() ?? null,
        },
        actorId,
      },
      tx
    );

    await tx.activityLog.create({
      data: {
        userId: actorId ?? renewal.domain.customerId,
        action: "domain.renewed",
        entity: "domain",
        entityId: renewal.domainId,
        details: {
          domain: renewal.domain.name,
          years: renewal.years,
          renewalId: renewal.id,
          invoiceId: renewal.invoiceId,
          newExpiresAt: newExpiresAt.toISOString(),
        },
      },
    });

    // "Alan adınız yenilendi" via the outbox (deduped per renewal, so a
    // retried job doesn't mail twice).
    await emitEvent(
      tx,
      "domain.renewed",
      {
        domainId: renewal.domainId,
        domain: renewal.domain.name,
        customerId: renewal.domain.customerId,
        renewalId: renewal.id,
        years: renewal.years,
        expiresAt: newExpiresAt,
        invoiceId: renewal.invoiceId,
      },
      { actorId: actorId ?? null }
    );
  });

  return newExpiresAt;
}

/**
 * Final renewal failure: in-app notification for every active admin plus the
 * staff e-mail (SMS when configured), once per renewal.
 */
export async function notifyAdminsRenewalFailed(input: {
  domainId: string;
  domain: string;
  renewalId: string;
  invoiceId: string | null;
  error: string;
}) {
  try {
    const admins = await db.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    });
    if (admins.length > 0) {
      await db.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: "ERROR" as const,
          title: "Alan adı yenilemesi başarısız",
          message: `${input.domain} registrar'da yenilenemedi (${input.error}). Ödeme alındı; elle yenileme gerekli.`,
          link: `/yonetim/domainler/${input.domainId}`,
        })),
      });
    }

    const { getAdminNotificationRecipients } = await import("@/lib/provisioning/manual");
    const recipients = await getAdminNotificationRecipients();
    if (recipients.email || recipients.phone) {
      await sendNotification({
        template: "admin.domain-renewal-failed",
        data: input,
        to: recipients.email,
        phone: recipients.phone,
        dedupeKey: `domain.renewal-failed:${input.renewalId}`,
      });
    }
  } catch (error) {
    domainLog.error("admin notification could not be queued", { renewalId: input.renewalId, error });
  }
}

async function failRenewal(renewal: RenewalWithDomain, error: string, final: boolean, notify: boolean) {
  await db.domainRenewal.update({
    where: { id: renewal.id },
    data: {
      status: final ? "FAILED" : "PAID",
      attempts: { increment: 1 },
      lastError: error.slice(0, 1000),
    },
  });

  await recordDomainEvent({
    domainId: renewal.domainId,
    type: final ? "renewal.failed" : "renewal.attempt_failed",
    message: final
      ? `Registrar yenilemesi başarısız oldu, yönetici müdahalesi gerekli: ${error}`
      : `Registrar yenileme denemesi başarısız (${renewal.attempts + 1}. deneme), tekrar denenecek: ${error}`,
    details: { renewalId: renewal.id, error, attempt: renewal.attempts + 1 },
  });

  if (final && notify) {
    await notifyAdminsRenewalFailed({
      domainId: renewal.domainId,
      domain: renewal.domain.name,
      renewalId: renewal.id,
      invoiceId: renewal.invoiceId,
      error,
    });
  }
}

async function loadRenewal(renewalId: string, client: DbClient = db) {
  return client.domainRenewal.findUnique({
    where: { id: renewalId },
    include: {
      domain: { select: { id: true, name: true, customerId: true, expiresAt: true, status: true } },
    },
  });
}

/** PAID/FAILED → PROCESSING (or take over a PROCESSING row left by a crashed run). */
async function claimRenewal(renewalId: string) {
  const claimed = await db.domainRenewal.updateMany({
    where: {
      id: renewalId,
      OR: [
        { status: { in: ["PAID", "FAILED"] } },
        { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) } },
      ],
    },
    data: { status: "PROCESSING" },
  });
  return claimed.count > 0;
}

export type RenewalRunResult =
  | { ok: true; renewalId: string; newExpiresAt: Date }
  | { ok: false; renewalId: string; error: string }
  | { skipped: string; renewalId: string };

async function executeRenewal(
  renewalId: string,
  options: { final: boolean; notifyOnFinal: boolean; actorId: string | null }
): Promise<RenewalRunResult> {
  const renewal = await loadRenewal(renewalId);
  if (!renewal) return { skipped: "RENEWAL_NOT_FOUND", renewalId };
  if (renewal.status === "COMPLETED") return { skipped: "ALREADY_COMPLETED", renewalId };
  if (renewal.status === "PENDING" || renewal.status === "CANCELLED") {
    // Never renew at the registrar without payment.
    return { skipped: "NOT_PAID", renewalId };
  }

  if (!(await claimRenewal(renewal.id))) {
    return { ok: false, renewalId, error: "RENEWAL_BUSY" };
  }

  const attempt = await attemptRegistrarRenew(renewal);
  if (attempt.ok) {
    const newExpiresAt = await completeRenewal(renewal, attempt, options.actorId);
    return { ok: true, renewalId, newExpiresAt };
  }

  await failRenewal(renewal, attempt.error, options.final, options.notifyOnFinal);
  return { ok: false, renewalId, error: attempt.error };
}

/**
 * Handler of the domain.renew queue job. Throws on failure so pg-boss retries
 * with backoff; the final attempt marks the renewal FAILED and notifies admins.
 */
export async function runDomainRenewal(renewalId: string, context: JobContext) {
  const result = await executeRenewal(renewalId, {
    final: context.isFinalAttempt,
    notifyOnFinal: true,
    actorId: null,
  });
  if ("ok" in result && !result.ok) {
    throw new Error(result.error);
  }
  return result;
}

async function dismissFailedQueueEntries(renewalId: string) {
  try {
    const boss = await getBoss();
    const jobs = await boss.findJobs(DOMAIN_RENEW_JOB, { key: renewalId });
    const failed = jobs.filter((job) => job.state === "failed").map((job) => job.id);
    if (failed.length) await boss.deleteJob(DOMAIN_RENEW_JOB, failed);
  } catch (error) {
    domainLog.warn("could not dismiss failed domain.renew jobs", { renewalId, error });
  }
}

export type ManualRenewResult =
  | { ok: true; newExpiresAt: Date; renewalId: string }
  | { ok: false; error: string };

/**
 * Admin "registrar'da yenile": runs the registrar renew now, inline.
 * - A paid (PAID/FAILED/stale PROCESSING) renewal of the domain is retried.
 * - Otherwise a renewal without invoice is created for the current period
 *   (admin decided to renew without billing); refused while the period has an
 *   open renewal invoice, so the customer is never charged for a renewal that
 *   was already done.
 */
export async function manualRegistrarRenew(domainId: string, actorId: string, years = 1): Promise<ManualRenewResult> {
  const domain = await db.domain.findUnique({
    where: { id: domainId },
    select: { id: true, name: true, expiresAt: true },
  });
  if (!domain) return { ok: false, error: "DOMAIN_NOT_FOUND" };

  let renewal = await db.domainRenewal.findFirst({
    where: { domainId, status: { in: ["PAID", "FAILED", "PROCESSING"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!renewal) {
    const current = await db.domainRenewal.findUnique({
      where: { domainId_periodStart: { domainId, periodStart: domain.expiresAt } },
      include: { invoice: { select: { status: true, invoiceNumber: true } } },
    });

    if (current?.status === "PENDING" && current.invoice && current.invoice.status !== "CANCELLED") {
      return { ok: false, error: `OPEN_INVOICE:${current.invoice.invoiceNumber}` };
    }

    const data = {
      status: "PAID" as const,
      source: "admin",
      years: Math.max(1, Math.round(years)),
      invoiceId: null,
      attempts: 0,
      lastError: null,
    };
    renewal = current
      ? await db.domainRenewal.update({ where: { id: current.id }, data, select: { id: true } })
      : await db.domainRenewal.create({
          data: { ...data, domainId, periodStart: domain.expiresAt },
          select: { id: true },
        });
  }

  await recordDomainEvent({
    domainId,
    type: "renewal.manual",
    message: "Yönetici registrar yenilemesini elle başlattı",
    details: { renewalId: renewal.id },
    actorId,
  });

  const result = await executeRenewal(renewal.id, { final: true, notifyOnFinal: false, actorId });
  if ("skipped" in result) return { ok: false, error: result.skipped };
  if (!result.ok) return { ok: false, error: result.error };

  await dismissFailedQueueEntries(renewal.id);
  return { ok: true, newExpiresAt: result.newExpiresAt, renewalId: renewal.id };
}

/**
 * Outbox reconciliation (daily domain-renewals cron), idempotent:
 * - PENDING renewals whose invoice is PAID (hook missed) → routed now;
 * - PENDING renewals whose invoice was cancelled/deleted → CANCELLED;
 * - PAID and stale PROCESSING renewals → (re)queued; deduplicated per renewal.
 */
export async function reconcileDomainRenewals() {
  const result = { routed: 0, cancelled: 0, queued: 0 };

  const pending = await db.domainRenewal.findMany({
    where: { status: "PENDING", OR: [{ invoice: { status: { in: ["PAID", "CANCELLED"] } } }, { invoiceId: null }] },
    select: { id: true, invoiceId: true, domainId: true, invoice: { select: { status: true } } },
    take: 500,
  });

  for (const renewal of pending) {
    if (renewal.invoiceId && renewal.invoice?.status === "PAID") {
      await db.$transaction((tx) => onDomainRenewalPaid(renewal.invoiceId!, tx));
      result.routed += 1;
    } else {
      await db.domainRenewal.updateMany({ where: { id: renewal.id, status: "PENDING" }, data: { status: "CANCELLED" } });
      result.cancelled += 1;
    }
  }

  await db.domainRenewal.updateMany({
    where: { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) } },
    data: { status: "PAID" },
  });

  const paid = await db.domainRenewal.findMany({
    where: { status: "PAID" },
    select: { id: true },
    take: 500,
  });
  for (const renewal of paid) {
    const { queued } = await queueDomainRenewal(db, renewal.id);
    if (queued) result.queued += 1;
  }

  return result;
}

