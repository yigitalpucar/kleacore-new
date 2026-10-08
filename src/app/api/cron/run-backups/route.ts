import { NextRequest } from "next/server";
import { runCronJob } from "@/lib/cron/handler";
import { runScheduledBackups } from "@/lib/cron/jobs/run-scheduled-backups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runCronJob(request, "run-backups", runScheduledBackups);
}

export async function POST(request: NextRequest) {
  return runCronJob(request, "run-backups", runScheduledBackups);
}