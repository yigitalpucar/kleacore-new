import { NextRequest } from "next/server";
import { runCronJob } from "@/lib/cron/handler";
import { drainJobs } from "@/lib/jobs/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Every-minute fallback worker: processes due queue jobs in-request within a
 * time budget, so the queue works without a separate worker service.
 * Not written to cron_runs (it would add 1440 rows a day); its liveness is
 * the `drain` heartbeat shown on /yonetim/isler and in /api/health.
 */
function drain() {
  const budgetMs = Number(process.env.JOBS_DRAIN_BUDGET_MS) || 45_000;
  return drainJobs({ budgetMs });
}

export async function GET(request: NextRequest) {
  return runCronJob(request, "jobs-drain", drain, { record: false });
}

export async function POST(request: NextRequest) {
  return runCronJob(request, "jobs-drain", drain, { record: false });
}
