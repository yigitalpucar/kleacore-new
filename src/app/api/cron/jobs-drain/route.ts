import { NextRequest } from "next/server";
import { sweepBroadcasts } from "@/lib/broadcasts/dispatch";
import { runCronJob } from "@/lib/cron/handler";
import { sweepPendingEvents } from "@/lib/events/dispatch";
import { createLogger } from "@/lib/logger";
import { drainJobs } from "@/lib/jobs/worker";

const log = createLogger("cron.jobs-drain");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Every-minute fallback worker: processes due queue jobs in-request within a
 * time budget, so the queue works without a separate worker service.
 * Not written to cron_runs (it would add 1440 rows a day); its liveness is
 * the `drain` heartbeat shown on /yonetim/isler and in /api/health.
 * First it sweeps the event outbox: domain events whose events.dispatch job
 * was never created (queue down at commit) get one and run in this drain;
 * then due / stalled broadcasts get their next dispatch tick.
 */
async function drain() {
  const budgetMs = Number(process.env.JOBS_DRAIN_BUDGET_MS) || 45_000;
  let events: Awaited<ReturnType<typeof sweepPendingEvents>> | { error: string };
  try {
    events = await sweepPendingEvents();
  } catch (error) {
    log.error("event outbox sweep failed", { error });
    events = { error: error instanceof Error ? error.message : String(error) };
  }
  let broadcasts: Awaited<ReturnType<typeof sweepBroadcasts>> | { error: string };
  try {
    broadcasts = await sweepBroadcasts();
  } catch (error) {
    log.error("broadcast sweep failed", { error });
    broadcasts = { error: error instanceof Error ? error.message : String(error) };
  }
  const jobs = await drainJobs({ budgetMs });
  return { ...jobs, events, broadcasts };
}

export async function GET(request: NextRequest) {
  return runCronJob(request, "jobs-drain", drain, { record: false });
}

export async function POST(request: NextRequest) {
  return runCronJob(request, "jobs-drain", drain, { record: false });
}
