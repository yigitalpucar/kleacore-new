import { db } from "@/lib/db";
import { sendNotification } from "@/lib/notifications/send";
import type { CronJobResult } from "./types";

const WARNING_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Notice buckets: one mail per certificate at 30, 7 and 1 days left and once when expired. */
export function sslNoticeBucket(expiresAt: Date, now: Date): "expired" | "1" | "7" | "30" | null {
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
  if (daysLeft <= 0) return "expired";
  if (daysLeft <= 1) return "1";
  if (daysLeft <= 7) return "7";
  if (daysLeft <= WARNING_DAYS) return "30";
  return null;
}

async function notifySslExpiry(input: {
  certificateId: string;
  customerId: string;
  domain: string;
  expiresAt: Date;
  expired: boolean;
  now: Date;
}) {
  const bucket = input.expired ? "expired" : sslNoticeBucket(input.expiresAt, input.now);
  if (!bucket) return;

  // Once per certificate and bucket (the cron runs daily; it used to mail
  // every day for 30 days).
  await sendNotification({
    userId: input.customerId,
    template: "ssl.expiry-notice",
    data: { domain: input.domain, expiresAt: input.expiresAt, expired: input.expired },
    dedupeKey: `ssl.expiry:${input.certificateId}:${bucket}:${input.expiresAt.toISOString().slice(0, 10)}`,
  });
}

export async function checkSslExpiry(): Promise<CronJobResult> {
  const now = new Date();
  const warningThreshold = addDays(now, WARNING_DAYS);
  const processedIds: string[] = [];

  const expired = await db.sslCertificate.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lt: now },
    },
    include: {
      customer: {
        select: {
          id: true,
          email: true,
          name: true,
          surname: true,
        },
      },
    },
  });

  if (expired.length > 0) {
    await db.sslCertificate.updateMany({
      where: { id: { in: expired.map((cert) => cert.id) } },
      data: { status: "EXPIRED" },
    });

    for (const cert of expired) {
      processedIds.push(cert.id);
      await notifySslExpiry({
        certificateId: cert.id,
        customerId: cert.customer.id,
        domain: cert.domain,
        expiresAt: cert.expiresAt ?? now,
        expired: true,
        now,
      });
    }
  }

  const expiringSoon = await db.sslCertificate.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: {
        gte: now,
        lte: warningThreshold,
      },
    },
    include: {
      customer: {
        select: {
          id: true,
          email: true,
          name: true,
          surname: true,
        },
      },
    },
  });

  for (const cert of expiringSoon) {
    if (!cert.expiresAt) {
      continue;
    }

    processedIds.push(cert.id);
    await notifySslExpiry({
      certificateId: cert.id,
      customerId: cert.customer.id,
      domain: cert.domain,
      expiresAt: cert.expiresAt,
      expired: false,
      now,
    });
  }

  return {
    processed: processedIds.length,
    ids: processedIds,
  };
}