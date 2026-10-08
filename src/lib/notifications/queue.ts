import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getBoss } from "@/lib/jobs/boss";
import { NOTIFICATION_SEND_JOB } from "@/lib/jobs/definitions";
import { enqueue } from "@/lib/jobs/enqueue";
import { createLogger } from "@/lib/logger";

const log = createLogger("notifications.queue");

/** How long a caller's transaction may wait for pg-boss before leaving the row to the reconcile cron. */
const BOSS_READY_TIMEOUT_MS = 2_000;

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
    log.error("job queue unavailable; notification left QUEUED for the reconcile cron", { error });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Enqueues delivery of one NotificationLog row. Idempotent per row
 * (exclusive queue, singletonKey = row id). A queue outage never fails the
 * caller: the row stays QUEUED and `requeueStaleNotifications` picks it up.
 */
export async function queueNotificationDelivery(notificationLogId: string, tx?: Prisma.TransactionClient) {
  if (!(await bossReady())) return { queued: false as const };
  const result = await enqueue(
    NOTIFICATION_SEND_JOB,
    { notificationLogId },
    { singletonKey: notificationLogId, ...(tx ? { tx } : {}) }
  );
  return { queued: !result.deduplicated };
}

const STALE_AFTER_MS = 10 * 60 * 1000;
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

/**
 * Outbox reconciliation (hourly "notifications" cron): QUEUED rows older than
 * 10 minutes whose enqueue was skipped (queue unreachable) get a job.
 * Rows that still have a queued/retrying/running job are deduplicated by the
 * singletonKey, so this never sends twice. Only the last 24 hours are
 * considered, so a job an admin cancelled on /yonetim/isler stays cancelled.
 */
export async function requeueStaleNotifications(now = new Date(), limit = 200) {
  const rows = await db.notificationLog.findMany({
    where: {
      status: "QUEUED",
      createdAt: { lt: new Date(now.getTime() - STALE_AFTER_MS), gt: new Date(now.getTime() - LOOKBACK_MS) },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let requeued = 0;
  for (const row of rows) {
    const result = await queueNotificationDelivery(row.id);
    if (result.queued) requeued += 1;
  }
  return { checked: rows.length, requeued };
}
