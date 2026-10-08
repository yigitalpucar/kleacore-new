import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withAdvisoryLock, type LockedResult } from "./lock";

const RETENTION_DAYS = 90;
const MAX_SUMMARY_IDS = 200;
const TIMEZONE = process.env.CRON_TIMEZONE || "Europe/Istanbul";

export type CronRunOutcome<T> =
  | { status: "succeeded"; runId: string | null; result: T }
  | { status: "locked" }
  | { status: "skipped"; reason: "already-ran-today"; previousRunId: string };

export interface CronRunOptions {
  /** Write a CronRun row (off for the every-minute jobs-drain). */
  record?: boolean;
  /**
   * Skip when a successful run already happened today (CRON_TIMEZONE), for
   * jobs whose side effects aren't safe to repeat (customer notifications).
   */
  oncePerDay?: boolean;
  /** Ignore `oncePerDay` (manual re-run). */
  force?: boolean;
  /** Override for tests. */
  lock?: <T>(key: string, fn: () => Promise<T>) => Promise<LockedResult<T>>;
}

export class CronRunError extends Error {
  constructor(
    readonly runId: string | null,
    readonly cause: unknown
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "CronRunError";
  }
}

function localDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(date);
}

/** Keeps the run log small and JSON-safe (dates → ISO, long id lists trimmed). */
export function toSummary(result: unknown): Prisma.InputJsonValue | undefined {
  if (result === undefined || result === null) return undefined;
  const json = JSON.parse(JSON.stringify(result)) as unknown;
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    if (Array.isArray(record.ids) && record.ids.length > MAX_SUMMARY_IDS) {
      record.idsTotal = record.ids.length;
      record.ids = record.ids.slice(0, MAX_SUMMARY_IDS);
    }
    return record as Prisma.InputJsonValue;
  }
  return { value: json } as Prisma.InputJsonValue;
}

/**
 * Runs a cron job under a Postgres advisory lock (one run per job name at a
 * time, across all containers) and records it in `cron_runs`.
 * A concurrent second run returns `{ status: "locked" }` without running.
 */
export async function runCronWithLock<T>(
  job: string,
  fn: () => Promise<T>,
  options: CronRunOptions = {}
): Promise<CronRunOutcome<T>> {
  const record = options.record ?? true;
  const lock = options.lock ?? withAdvisoryLock;

  const outcome = await lock(job, async (): Promise<CronRunOutcome<T>> => {
    const now = new Date();

    if (record) {
      // We hold the lock, so a RUNNING row of this job belongs to a run whose
      // process died (the lock was released with its connection).
      await db.cronRun.updateMany({
        where: { job, status: "RUNNING" },
        data: { status: "FAILED", finishedAt: now, error: "Yarıda kaldı (süreç sonlandı)" },
      });
    }

    if (options.oncePerDay && !options.force) {
      const previous = await db.cronRun.findFirst({
        where: { job, status: "SUCCEEDED" },
        orderBy: { startedAt: "desc" },
        select: { id: true, startedAt: true },
      });
      if (previous && localDate(previous.startedAt) === localDate(now)) {
        if (record) {
          await db.cronRun.create({
            data: {
              job,
              status: "SKIPPED",
              finishedAt: now,
              durationMs: 0,
              summary: { reason: "already-ran-today", previousRunId: previous.id },
            },
          });
        }
        return { status: "skipped", reason: "already-ran-today", previousRunId: previous.id };
      }
    }

    const run = record ? await db.cronRun.create({ data: { job, startedAt: now } }) : null;
    const started = Date.now();

    try {
      const result = await fn();
      if (run) {
        await db.cronRun.update({
          where: { id: run.id },
          data: {
            status: "SUCCEEDED",
            finishedAt: new Date(),
            durationMs: Date.now() - started,
            summary: toSummary(result),
          },
        });
        await db.cronRun.deleteMany({
          where: { job, startedAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 86_400_000) } },
        });
      }
      return { status: "succeeded", runId: run?.id ?? null, result };
    } catch (error) {
      if (run) {
        await db.cronRun
          .update({
            where: { id: run.id },
            data: {
              status: "FAILED",
              finishedAt: new Date(),
              durationMs: Date.now() - started,
              error: (error instanceof Error ? error.message : String(error)).slice(0, 2000),
            },
          })
          .catch(() => {});
      }
      throw new CronRunError(run?.id ?? null, error);
    }
  });

  if (!outcome.acquired) {
    if (record) {
      await db.cronRun.create({
        data: { job, status: "LOCKED", finishedAt: new Date(), durationMs: 0 },
      });
    }
    return { status: "locked" };
  }

  return outcome.value;
}
