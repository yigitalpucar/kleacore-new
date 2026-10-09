import type { BroadcastRecipientStatus } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Delivery progress of a broadcast. The recipient row mirrors its
 * NotificationLog: deliver.ts reports final outcomes here, and
 * `syncRecipientsFromLogs` catches up rows whose report was lost.
 */

export type RecipientCounts = Record<BroadcastRecipientStatus, number> & { total: number };

const EMPTY: RecipientCounts = { PENDING: 0, QUEUED: 0, SENT: 0, FAILED: 0, SKIPPED: 0, CANCELLED: 0, total: 0 };

/** Called by the notification worker after a broadcast message reached a final state. */
export async function recordBroadcastDelivery(notificationLogId: string, status: "SENT" | "SKIPPED" | "FAILED", error: string | null) {
  const now = new Date();
  await db.broadcastRecipient.updateMany({
    where: { notificationLogId },
    data: {
      status,
      error: status === "SENT" ? null : (error ?? "").slice(0, 500) || null,
      ...(status === "SENT" ? { sentAt: now } : {}),
    },
  });
}

/** QUEUED recipients whose NotificationLog is already final take its status. */
export async function syncRecipientsFromLogs(broadcastId: string) {
  return db.$executeRaw`
    UPDATE "broadcast_recipients" AS r
    SET "status" = (CASE l."status" WHEN 'SENT' THEN 'SENT' WHEN 'FAILED' THEN 'FAILED' ELSE 'SKIPPED' END)::"BroadcastRecipientStatus",
        "error" = CASE WHEN l."status" = 'SENT' THEN NULL ELSE LEFT(l."error", 500) END,
        "sentAt" = l."sentAt",
        "updatedAt" = NOW()
    FROM "notification_logs" AS l
    WHERE r."broadcastId" = ${broadcastId}
      AND r."status" = 'QUEUED'
      AND r."notificationLogId" = l."id"
      AND l."status" IN ('SENT', 'FAILED', 'SKIPPED')`;
}

export async function getRecipientCounts(broadcastId: string): Promise<RecipientCounts> {
  const rows = await db.broadcastRecipient.groupBy({ by: ["status"], where: { broadcastId }, _count: { _all: true } });
  const counts = { ...EMPTY };
  for (const row of rows) {
    counts[row.status] = row._count._all;
    counts.total += row._count._all;
  }
  return counts;
}

/** Counts for several broadcasts at once (list page). */
export async function getRecipientCountsFor(broadcastIds: string[]) {
  const out = new Map<string, RecipientCounts>();
  if (broadcastIds.length === 0) return out;
  const rows = await db.broadcastRecipient.groupBy({
    by: ["broadcastId", "status"],
    where: { broadcastId: { in: broadcastIds } },
    _count: { _all: true },
  });
  for (const row of rows) {
    const counts = out.get(row.broadcastId) ?? { ...EMPTY };
    counts[row.status] = row._count._all;
    counts.total += row._count._all;
    out.set(row.broadcastId, counts);
  }
  return out;
}
