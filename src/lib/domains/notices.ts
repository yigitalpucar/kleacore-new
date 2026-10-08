import { db } from "@/lib/db";
import { formatDate } from "@/lib/format/date";
import { sendNotification } from "@/lib/notifications/send";
import { getAppBaseUrl } from "@/lib/stripe";
import type { CronJobResult } from "@/lib/cron/jobs/types";
import {
  DAY_MS,
  domainLog,
  getDomainLifecycleSettings,
  isUniqueViolation,
  recordDomainEvent,
  type DomainLifecycleSettings,
} from "./lifecycle";

/**
 * Expiry notices (roadmap 1.3): 30/7/1 days before expiry, on expiry, before
 * the grace period ends and on entering redemption. Each kind is sent once per
 * domain + period (DomainNotice marker, unique on domainId + kind +
 * periodStart = expiresAt), so a renewed domain gets a fresh cycle.
 */

export type DomainNoticeKind =
  | "expiring_30"
  | "expiring_7"
  | "expiring_1"
  | "expired"
  | "grace_ending"
  | "redemption";

/** Days before the end of grace the "grace ending" warning goes out. */
const GRACE_WARNING_DAYS = 5;

/**
 * The single notice due for a domain right now: the bucket its expiry falls
 * in. A domain first seen 5 days before expiry gets "expiring_7" only, never a
 * stale "expiring_30".
 */
export function noticeKindFor(
  expiresAt: Date,
  now: Date,
  settings: Pick<DomainLifecycleSettings, "graceDays" | "redemptionDays">
): DomainNoticeKind | null {
  const msLeft = expiresAt.getTime() - now.getTime();

  if (msLeft > 0) {
    const daysLeft = Math.ceil(msLeft / DAY_MS);
    if (daysLeft <= 1) return "expiring_1";
    if (daysLeft <= 7) return "expiring_7";
    if (daysLeft <= 30) return "expiring_30";
    return null;
  }

  const daysSince = Math.floor(-msLeft / DAY_MS);
  const graceWarningAt = Math.max(settings.graceDays - GRACE_WARNING_DAYS, 1);
  if (daysSince < graceWarningAt) return "expired";
  if (daysSince < settings.graceDays) return "grace_ending";
  if (daysSince < settings.graceDays + settings.redemptionDays) return "redemption";
  return null;
}

interface NoticeDomain {
  id: string;
  name: string;
  customerId: string;
  expiresAt: Date;
  autoRenew: boolean;
}

export function noticeContent(kind: DomainNoticeKind, domain: NoticeDomain, settings: DomainLifecycleSettings) {
  const date = formatDate(domain.expiresAt);
  const renewHint = domain.autoRenew
    ? "Yenileme faturanızı ödediğinizde alan adınız otomatik olarak yenilenir."
    : "Otomatik yenileme kapalı; alan adınızı korumak için panelden “Şimdi yenile” ile yenileyin.";
  const graceEnd = formatDate(new Date(domain.expiresAt.getTime() + settings.graceDays * DAY_MS));

  switch (kind) {
    case "expiring_30":
    case "expiring_7":
    case "expiring_1": {
      const days = kind === "expiring_30" ? 30 : kind === "expiring_7" ? 7 : 1;
      return {
        type: days === 30 ? "INFO" : "WARNING",
        title: `${domain.name} ${days === 1 ? "yarın" : `${days} gün içinde`} sona eriyor`,
        message: `${domain.name} alan adınızın süresi ${date} tarihinde doluyor. ${renewHint}`,
      };
    }
    case "expired":
      return {
        type: "ERROR",
        title: `${domain.name} süresi doldu`,
        message: `${domain.name} alan adınızın süresi ${date} tarihinde doldu. ${graceEnd} tarihine kadar normal ücretle yenileyebilirsiniz.`,
      };
    case "grace_ending":
      return {
        type: "ERROR",
        title: `${domain.name} için ek süre bitiyor`,
        message: `${domain.name} için yenileme ek süresi ${graceEnd} tarihinde bitiyor. Sonrasında alan adı geri alma (redemption) sürecine girer ve ek ücret gerekir.`,
      };
    case "redemption":
      return {
        type: "ERROR",
        title: `${domain.name} geri alma sürecinde`,
        message: `${domain.name} yenileme ek süresini aştı ve geri alma (redemption) sürecinde. Alan adını kaybetmemek için destek ekibimizle iletişime geçin.`,
      };
  }
}

const NOTICE_STAGE: Record<DomainNoticeKind, "expiring" | "expired" | "grace_ending" | "redemption"> = {
  expiring_30: "expiring",
  expiring_7: "expiring",
  expiring_1: "expiring",
  expired: "expired",
  grace_ending: "grace_ending",
  redemption: "redemption",
};

async function sendDomainNotice(
  domain: NoticeDomain,
  kind: DomainNoticeKind,
  settings: DomainLifecycleSettings,
  now: Date
) {
  // Marker first: a concurrent or repeated run hits the unique key and stops.
  let markerId: string;
  try {
    const marker = await db.domainNotice.create({
      data: { domainId: domain.id, kind, periodStart: domain.expiresAt },
      select: { id: true },
    });
    markerId = marker.id;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }

  const content = noticeContent(kind, domain, settings);
  const daysLeft = Math.ceil((domain.expiresAt.getTime() - now.getTime()) / DAY_MS);
  const result = await sendNotification({
    userId: domain.customerId,
    template: "domain.expiry-notice",
    data: {
      domain: domain.name,
      daysLeft: kind === "expiring_30" ? 30 : kind === "expiring_7" ? 7 : kind === "expiring_1" ? 1 : Math.min(0, daysLeft),
      expiresAt: domain.expiresAt,
      stage: NOTICE_STAGE[kind],
      graceEndsAt: new Date(domain.expiresAt.getTime() + settings.graceDays * DAY_MS),
      autoRenew: domain.autoRenew,
      renewUrl: `${getAppBaseUrl()}/musteri/panel/domainler/${domain.id}`,
    },
    dedupeKey: `domain.notice:${domain.id}:${kind}:${domain.expiresAt.toISOString().slice(0, 10)}`,
  });
  if (!result.ok) {
    // Not queued: drop the marker so tomorrow's run tries again.
    await db.domainNotice.delete({ where: { id: markerId } }).catch(() => {});
    throw new Error(result.error ?? "NOTIFICATION_NOT_QUEUED");
  }

  await recordDomainEvent({
    domainId: domain.id,
    type: "notice.sent",
    message: `Müşteriye bildirim gönderildi: ${content.title}`,
    details: { kind },
  });
  return true;
}

/**
 * Daily: marks ACTIVE domains past expiry as EXPIRED and sends the due expiry
 * notice of every ACTIVE/EXPIRED domain. Pre-expiry notices are skipped while
 * the period's renewal is already paid (registrar renew in progress).
 */
export async function sendDomainExpiryNotices(now = new Date()): Promise<CronJobResult & Record<string, unknown>> {
  const settings = await getDomainLifecycleSettings();

  const expired = await db.domain.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: now } },
    select: { id: true, expiresAt: true },
  });
  for (const domain of expired) {
    const updated = await db.domain.updateMany({
      where: { id: domain.id, status: "ACTIVE", expiresAt: { lt: now } },
      data: { status: "EXPIRED" },
    });
    if (updated.count > 0) {
      await recordDomainEvent({
        domainId: domain.id,
        type: "status.expired",
        message: `Bitiş tarihi (${formatDate(domain.expiresAt)}) geçti; durum "Süresi doldu" yapıldı`,
      });
    }
  }

  const oldest = new Date(now.getTime() - (settings.graceDays + settings.redemptionDays) * DAY_MS);
  const newest = new Date(now.getTime() + 30 * DAY_MS);
  const domains = await db.domain.findMany({
    where: {
      status: { in: ["ACTIVE", "EXPIRED"] },
      expiresAt: { gte: oldest, lte: newest },
    },
    select: {
      id: true,
      name: true,
      customerId: true,
      expiresAt: true,
      autoRenew: true,
      renewals: { where: { status: { in: ["PAID", "PROCESSING", "COMPLETED"] } }, select: { periodStart: true } },
    },
  });

  const ids: string[] = [];
  const byKind: Record<string, number> = {};
  let skipped = 0;

  for (const domain of domains) {
    const kind = noticeKindFor(domain.expiresAt, now, settings);
    if (!kind) continue;

    const renewing = domain.renewals.some((r) => r.periodStart.getTime() === domain.expiresAt.getTime());
    if (renewing) {
      skipped += 1;
      continue;
    }

    try {
      if (await sendDomainNotice(domain, kind, settings, now)) {
        ids.push(domain.id);
        byKind[kind] = (byKind[kind] ?? 0) + 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      skipped += 1;
      domainLog.error("domain notice could not be sent", { domainId: domain.id, kind, error });
    }
  }

  return { processed: ids.length, skipped, markedExpired: expired.length, byKind, ids };
}
