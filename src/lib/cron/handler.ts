import { NextRequest } from "next/server";
import { isCronConfigured, verifyCronRequest } from "@/lib/cron/auth";
import { runCronWithLock, type CronRunOptions } from "@/lib/cron/run-log";
import { error, success, unauthorized } from "@/lib/utils/api-response";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron");

/**
 * Shared cron route body: CRON_SECRET auth, then the job under an advisory
 * lock with a `cron_runs` record (see run-log.ts). A run that finds the lock
 * held answers 200 `{ status: "locked" }` — overlapping schedules are expected
 * and not a failure. `?force=1` bypasses the once-per-day guard.
 */
export async function runCronJob<T>(
  request: NextRequest,
  job: string,
  fn: () => Promise<T>,
  options: Omit<CronRunOptions, "force"> = {}
) {
  if (!verifyCronRequest(request)) {
    log.warn("cron request rejected", {
      path: request.nextUrl.pathname,
      cronSecretConfigured: isCronConfigured(),
    });
    return unauthorized("Invalid cron secret");
  }

  const path = request.nextUrl.pathname;
  const started = Date.now();
  const force = request.nextUrl.searchParams.get("force") === "1";

  try {
    const outcome = await runCronWithLock(job, fn, { ...options, force });
    const durationMs = Date.now() - started;

    if (outcome.status === "locked") {
      log.warn("cron job locked", { path, job, durationMs });
      return success({ status: "locked", job });
    }

    if (outcome.status === "skipped") {
      log.info("cron job skipped", { path, job, reason: outcome.reason, durationMs });
      return success({ status: "skipped", job, reason: outcome.reason });
    }

    log.info("cron job finished", { path, job, durationMs });
    const result = outcome.result;
    const body = result && typeof result === "object" && !Array.isArray(result) ? result : { result };
    return success({ ...body, status: "succeeded", job, runId: outcome.runId });
  } catch (err) {
    log.error("cron job failed", { path, job, durationMs: Date.now() - started, error: err });
    return error("Cron job failed", 500);
  }
}
