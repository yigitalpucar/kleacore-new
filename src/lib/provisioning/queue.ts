import type { PrismaTransactionLike } from "pg-boss";
import { enqueue } from "@/lib/jobs/enqueue";
import { getBoss } from "@/lib/jobs/boss";
import { PROVISIONING_RUN_JOB, provisioningRunJob } from "@/lib/jobs/definitions";
import { createLogger } from "@/lib/logger";

const log = createLogger("provisioning.queue");

/** How long a transaction may wait for pg-boss to come up before skipping the enqueue. */
const BOSS_READY_TIMEOUT_MS = 2_000;
const QUEUE_DOWN_BACKOFF_MS = 30_000;
let queueDownUntil = 0;

type ProvisioningJobRecord = { id: string; attempts: number; maxAttempts: number };

/** Queue attempts left for a record, so legacy rows keep their remaining retry budget. */
export function remainingRetryLimit(record: ProvisioningJobRecord) {
  return Math.max(record.maxAttempts - record.attempts - 1, 0);
}

/**
 * Whether pg-boss is up (waits at most 2 s). Used before enqueueing inside a
 * payment transaction so a queue outage never blocks or rolls back a payment.
 */
export async function isJobQueueReady(): Promise<boolean> {
  // After a failed check, answer "no" at once for a while: a payment
  // transaction may ask several times (one per invoice / job) and must not
  // add 2 s per question while the queue is down.
  if (Date.now() < queueDownUntil) {
    return false;
  }

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
    queueDownUntil = Date.now() + QUEUE_DOWN_BACKOFF_MS;
    log.error("job queue unavailable; provisioning job left for the reconcile cron", { error });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Schedules a queue attempt for a ProvisioningJob row. Pass the Prisma
 * transaction that wrote the row so both commit together.
 *
 * Never fails the caller's transaction for a queue outage: if pg-boss can't
 * be reached the row stays PENDING and `reconcileProvisioningQueue` (the
 * retry-provisioning cron) enqueues it later. Idempotent per row
 * (singletonKey = row id on an exclusive queue).
 */
export async function queueProvisioningAttempt(
  client: PrismaTransactionLike,
  record: ProvisioningJobRecord,
  options: { startAfter?: Date | number } = {}
) {
  if (!(await isJobQueueReady())) {
    return { queued: false as const, deduplicated: false };
  }

  const result = await enqueue(
    PROVISIONING_RUN_JOB,
    { provisioningJobId: record.id },
    {
      singletonKey: record.id,
      retryLimit: Math.min(remainingRetryLimit(record), provisioningRunJob.queue.retryLimit ?? 4),
      startAfter: options.startAfter,
      tx: client,
    }
  );
  return { queued: !result.deduplicated, deduplicated: result.deduplicated };
}

/**
 * After a provisioning job was resolved outside the queue (manual retry on
 * /yonetim/provisioning), drop its failed queue entries so the "İşler" screen
 * doesn't keep listing a problem that no longer exists.
 */
export async function dismissFailedQueueEntries(provisioningJobId: string) {
  try {
    const boss = await getBoss();
    const jobs = await boss.findJobs(PROVISIONING_RUN_JOB, { key: provisioningJobId });
    const failedIds = jobs.filter((job) => job.state === "failed").map((job) => job.id);
    if (failedIds.length > 0) {
      await boss.deleteJob(PROVISIONING_RUN_JOB, failedIds);
    }
  } catch (error) {
    log.warn("could not dismiss failed queue entries", { provisioningJobId, error });
  }
}
