import { NextRequest } from "next/server";
import { runCronJob } from "@/lib/cron/handler";
import { reconcileProvisioningQueue } from "@/lib/provisioning/retry-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runCronJob(request, "retry-provisioning", reconcileProvisioningQueue);
}

export async function POST(request: NextRequest) {
  return runCronJob(request, "retry-provisioning", reconcileProvisioningQueue);
}