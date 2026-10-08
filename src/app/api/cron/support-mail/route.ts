import { NextRequest } from "next/server";
import { runCronJob } from "@/lib/cron/handler";
import { pollSupportMailboxes } from "@/lib/support/inbound/poller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const run = () => pollSupportMailboxes();

export async function GET(request: NextRequest) {
  return runCronJob(request, "support-mail", run);
}

export async function POST(request: NextRequest) {
  return runCronJob(request, "support-mail", run);
}
