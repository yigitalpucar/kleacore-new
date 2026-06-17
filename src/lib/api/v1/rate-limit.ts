import { checkRateLimit, normalizeRateLimitKey } from "@/lib/rate-limit";
import { error } from "@/lib/utils/api-response";
import type { NextResponse } from "next/server";

const API_V1_LIMIT = 30;
const API_V1_WINDOW_MS = 10 * 60 * 1000;

export async function enforceApiRateLimit(
  apiKeyId: string
): Promise<NextResponse | null> {
  const limit = await checkRateLimit({
    key: `api-v1:${normalizeRateLimitKey(apiKeyId)}`,
    limit: API_V1_LIMIT,
    windowMs: API_V1_WINDOW_MS,
  });

  if (!limit.allowed) {
    return error(
      "Çok fazla API isteği yapıldı. Lütfen biraz sonra tekrar deneyin.",
      429
    );
  }

  return null;
}