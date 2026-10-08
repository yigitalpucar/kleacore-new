import { NextRequest } from "next/server";
import { runCronJob } from "@/lib/cron/handler";
import { syncTcmbRates } from "@/lib/fx/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily TCMB rates (USD/EUR/GBP) + opt-in TLD price auto-apply.
 * `?date=YYYY-MM-DD` backfills one day from the TCMB archive (no auto-apply).
 */
function handle(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("date");
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
  return runCronJob(request, date ? "fx-rates-backfill" : "fx-rates", () => syncTcmbRates({ date }));
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
