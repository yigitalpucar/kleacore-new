import { NextRequest } from "next/server";
import { verifyCronRequest } from "@/lib/cron/auth";
import { error, success, unauthorized } from "@/lib/utils/api-response";

export async function runCronJob<T>(
  request: NextRequest,
  job: () => Promise<T>
) {
  if (!verifyCronRequest(request)) {
    return unauthorized("Invalid cron secret");
  }

  try {
    const result = await job();
    return success(result);
  } catch (err) {
    console.error("[Cron]", err);
    return error("Cron job failed", 500);
  }
}