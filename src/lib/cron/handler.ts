import { NextRequest } from "next/server";
import { isCronConfigured, verifyCronRequest } from "@/lib/cron/auth";
import { error, success, unauthorized } from "@/lib/utils/api-response";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron");

export async function runCronJob<T>(
  request: NextRequest,
  job: () => Promise<T>
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
  try {
    const result = await job();
    log.info("cron job finished", { path, durationMs: Date.now() - started });
    return success(result);
  } catch (err) {
    log.error("cron job failed", { path, durationMs: Date.now() - started, error: err });
    return error("Cron job failed", 500);
  }
}