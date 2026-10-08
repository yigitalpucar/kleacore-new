import { NextRequest } from "next/server";
import { runCronJob } from "@/lib/cron/handler";
import { runAutoCharge } from "@/lib/payments/auto-charge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Charges cards: once per day. The PaymentAttempt key (invoice + date) keeps
// even a forced re-run from charging an invoice twice on the same day.
const run = (request: NextRequest) => runCronJob(request, "auto-charge", () => runAutoCharge(), { oncePerDay: true });

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
