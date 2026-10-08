import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("health");
const DB_TIMEOUT_MS = 3000;

/**
 * Liveness/readiness probe for the Docker HEALTHCHECK and uptime monitors.
 * Public and unauthenticated, so it only ever reports "ok"/"error" — never
 * connection strings, versions or error messages.
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

  const healthy = database === "ok";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "error",
      checks: { database },
      durationMs: Date.now() - started,
      time: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
