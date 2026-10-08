import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getWorkerHealth } from "@/lib/jobs/heartbeat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("health");
const DB_TIMEOUT_MS = 3000;

/**
 * Liveness/readiness probe for the Docker HEALTHCHECK and uptime monitors.
 * Public and unauthenticated, so it only ever reports "ok"/"degraded"/"error" —
 * never connection strings, versions or error messages.
 *
 * `checks.jobs` is "degraded" when no queue worker or drain run has checked in
 * for JOBS_WORKER_STALE_MINUTES (default 5): the app still serves traffic, so
 * this stays HTTP 200 (only a database failure is 503 / container-unhealthy).
 */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "error" = "ok";

  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("database ping timed out")), DB_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    database = "error";
    log.error("database ping failed", { error: err });
  }

  let jobs: "ok" | "degraded" | "error" = "error";
  if (database === "ok") {
    try {
      jobs = (await getWorkerHealth()).status === "ok" ? "ok" : "degraded";
    } catch (err) {
      log.error("job worker heartbeat check failed", { error: err });
    }
  }

  const healthy = database === "ok";
  return NextResponse.json(
    {
      status: !healthy ? "error" : jobs === "ok" ? "ok" : "degraded",
      checks: { database, jobs },
      durationMs: Date.now() - started,
      time: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
