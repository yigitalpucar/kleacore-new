import { NextRequest } from "next/server";
import { runCronJob } from "@/lib/cron/handler";
import { runTicketAutoClose } from "@/lib/support/auto-close";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const run = () => runTicketAutoClose();

export async function GET(request: NextRequest) {
  return runCronJob(request, "support-autoclose", run);
}

export async function POST(request: NextRequest) {
  return runCronJob(request, "support-autoclose", run);
}
