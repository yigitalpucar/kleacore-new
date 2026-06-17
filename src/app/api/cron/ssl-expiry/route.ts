import { NextRequest } from "next/server";
import { runCronJob } from "@/lib/cron/handler";
import { checkSslExpiry } from "@/lib/cron/jobs/check-ssl-expiry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runCronJob(request, checkSslExpiry);
}

export async function POST(request: NextRequest) {
  return runCronJob(request, checkSslExpiry);
}