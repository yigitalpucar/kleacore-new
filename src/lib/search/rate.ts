import { checkRateLimit } from "@/lib/rate-limit";

/** ⌘K search budget per user: the client debounces, so 60/min is generous. */
export const SEARCH_RATE_LIMIT = { limit: 60, windowMs: 60_000 } as const;

export async function allowSearch(userId: string) {
  return checkRateLimit({ key: `cmdk:${userId}`, ...SEARCH_RATE_LIMIT });
}
