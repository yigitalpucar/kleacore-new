import { NextRequest } from "next/server";
import { runCronJob } from "@/lib/cron/handler";
import { runDomainSync } from "@/lib/cron/jobs/domain-lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runCronJob(request, "domain-sync", runDomainSync);
}

export async function POST(request: NextRequest) {
  return runCronJob(request, "domain-sync", runDomainSync);
}
