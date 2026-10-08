import { NextRequest } from "next/server";
import { runCronJob } from "@/lib/cron/handler";
import { suspendOverdueServices } from "@/lib/cron/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runCronJob(request, "suspend-services", suspendOverdueServices);
}

export async function POST(request: NextRequest) {
  return runCronJob(request, "suspend-services", suspendOverdueServices);
}