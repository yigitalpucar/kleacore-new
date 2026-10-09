import { NextRequest } from "next/server";
import { runCronJob } from "@/lib/cron/handler";
import { runKycRetention } from "@/lib/kyc/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const run = () => runKycRetention();

export async function GET(request: NextRequest) {
  return runCronJob(request, "kyc-retention", run);
}

export async function POST(request: NextRequest) {
  return runCronJob(request, "kyc-retention", run);
}
