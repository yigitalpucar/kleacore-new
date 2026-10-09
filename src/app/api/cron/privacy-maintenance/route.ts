import { NextRequest } from "next/server";
import { runCronJob } from "@/lib/cron/handler";
import { runPrivacyMaintenance } from "@/lib/privacy/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const run = () => runPrivacyMaintenance();

export async function GET(request: NextRequest) {
  return runCronJob(request, "privacy-maintenance", run);
}

export async function POST(request: NextRequest) {
  return runCronJob(request, "privacy-maintenance", run);
}
