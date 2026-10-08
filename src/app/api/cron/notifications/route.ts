import { NextRequest } from "next/server";
import { runCronJob } from "@/lib/cron/handler";
import { sendScheduledNotifications } from "@/lib/cron/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runCronJob(request, "notifications", sendScheduledNotifications);
}

export async function POST(request: NextRequest) {
  return runCronJob(request, "notifications", sendScheduledNotifications);
}
