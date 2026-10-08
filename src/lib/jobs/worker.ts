import { hostname } from "node:os";
import type { JobWithMetadata, PgBoss } from "pg-boss";
import { createLogger } from "@/lib/logger";
import { getBoss } from "./boss";
import { jobRegistry, type RegisteredJob } from "./definitions";
import { recordHeartbeat } from "./heartbeat";
import type { JobContext } from "./registry";

const log = createLogger("jobs");

type QueuedJob = Pick<JobWithMetadata<unknown>, "id" | "name" | "data" | "retryCount" | "retryLimit">;

export function jobContext(job: QueuedJob): JobContext {
  return {
    jobId: job.id,
    retryCount: job.retryCount,
    retryLimit: job.retryLimit,
    isFinalAttempt: job.retryCount >= job.retryLimit,
  };
}

/** Validates the payload and runs the handler. Throws to let pg-boss retry/fail. */
export async function runJob(definition: RegisteredJob, job: QueuedJob): Promise<unknown> {
  const payload = jobRegistry.parse(definition.name, job.data);
  const started = Date.now();
  try {
    const output = await definition.handler(payload as never, jobContext(job));
    log.info("job completed", { job: job.name, id: job.id, attempt: job.retryCount + 1, durationMs: Date.now() - started });
    return output;
  } catch (error) {
    log.warn("job attempt failed", {
      job: job.name,
      id: job.id,
      attempt: job.retryCount + 1,
      final: job.retryCount >= job.retryLimit,
      durationMs: Date.now() - started,
      error,
    });
    throw error;
  }
}

export function serializeJobError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function toOutput(value: unknown): object | null {
  if (value === undefined || value === null) return null;
  return typeof value === "object" ? (value as object) : { value };
}

export interface DrainOptions {
  /** Stop fetching new jobs after this many ms (a running job is never cut off). */
  budgetMs?: number;
  /** Upper bound of jobs handled in one drain. */
  maxJobs?: number;
  /** Only these queues (defaults to every registered job). */
  names?: string[];
  /** Override for tests. */
  boss?: PgBoss;
}

export interface DrainResult {
  completed: number;
  failed: number;
  byQueue: Record<string, { completed: number; failed: number }>;
  /** True when the budget or maxJobs stopped the drain with work possibly left. */
  truncated: boolean;
  durationMs: number;
}

/**
 * Processes due jobs inside the current request (the `jobs-drain` cron), one
 * job at a time across all queues until the queues are empty or the time
 * budget is used. Works without a separate worker service; when a worker is
 * running both just compete for jobs (pg-boss claims with SKIP LOCKED).
 */
export async function drainJobs(options: DrainOptions = {}): Promise<DrainResult> {
  const started = Date.now();
  const deadline = started + (options.budgetMs ?? 45_000);
  const maxJobs = options.maxJobs ?? 200;
  const names = options.names ?? jobRegistry.names();
  const boss = options.boss ?? (await getBoss());

  await recordHeartbeat("drain", "drain", { host: hostname() });

  // The web role runs without pg-boss timers: expire stuck active jobs, apply
  // retention etc. here. Failure only delays housekeeping.
  try {
    await boss.supervise();
  } catch (error) {
    log.warn("pg-boss maintenance failed", { error });
  }

  const result: DrainResult = { completed: 0, failed: 0, byQueue: {}, truncated: false, durationMs: 0 };
  let handled = 0;
  let sawWork = true;

  while (sawWork) {
    sawWork = false;
    for (const name of names) {
      if (Date.now() >= deadline || handled >= maxJobs) {
        result.truncated = true;
        sawWork = false;
        break;
      }

      const definition = jobRegistry.get(name);
      const [job] = await boss.fetch<unknown>(name, { batchSize: 1, includeMetadata: true });
      if (!job) continue;

      sawWork = true;
      handled += 1;
      const counts = (result.byQueue[name] ??= { completed: 0, failed: 0 });
      const attempt = { id: job.id, retryCount: job.retryCount };

      try {
        const output = await runJob(definition, job);
        await boss.complete(name, attempt, toOutput(output));
        counts.completed += 1;
        result.completed += 1;
      } catch (error) {
        await boss.fail(name, attempt, serializeJobError(error));
        counts.failed += 1;
        result.failed += 1;
      }
    }
  }

  if (Date.now() - started > 5_000) {
    await recordHeartbeat("drain", "drain", { host: hostname() });
  }

  result.durationMs = Date.now() - started;
  return result;
}

export interface WorkerHandle {
  stop(): Promise<void>;
}

/**
 * Long-running worker (the separate `worker` service): subscribes to every
 * registered queue and writes a heartbeat every 30s.
 */
export async function startWorker(options: { concurrency?: number; heartbeatMs?: number } = {}): Promise<WorkerHandle> {
  const boss = await getBoss();
  const heartbeatId = `worker:${hostname()}`;
  const concurrency = options.concurrency ?? (Number(process.env.JOBS_WORKER_CONCURRENCY) || 2);

  for (const definition of jobRegistry.all()) {
    await boss.work(
      definition.name,
      { includeMetadata: true as const, batchSize: 1, localConcurrency: concurrency, pollingIntervalSeconds: 2 },
      async ([job]) => toOutput(await runJob(definition, job))
    );
  }

  const beat = () =>
    recordHeartbeat(heartbeatId, "worker", { host: hostname(), queues: jobRegistry.names(), concurrency }).catch(
      (error) => log.error("worker heartbeat failed", { error })
    );
  await beat();
  const timer = setInterval(beat, options.heartbeatMs ?? 30_000);
  timer.unref();

  log.info("worker started", { queues: jobRegistry.names(), concurrency });

  return {
    async stop() {
      clearInterval(timer);
      for (const name of jobRegistry.names()) {
        await boss.offWork(name, { wait: true }).catch(() => {});
      }
    },
  };
}
