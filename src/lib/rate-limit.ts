import { db } from "@/lib/db";

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

const buckets = new Map<string, { count: number; resetAt: number }>();
const useInMemoryRateLimit = process.env.VITEST === "true";

function checkRateLimitInMemory({
  key,
  limit,
  windowMs,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count };
}

async function checkRateLimitDb({
  key,
  limit,
  windowMs,
}: RateLimitOptions): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  const existing = await db.rateLimitBucket.findUnique({
    where: { key },
    select: { count: true, resetAt: true },
  });

  if (!existing || existing.resetAt <= now) {
    const bucket = await db.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: { count: 1, resetAt },
      select: { count: true, resetAt: true },
    });

    return { allowed: true, remaining: limit - bucket.count };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(
        (existing.resetAt.getTime() - now.getTime()) / 1000
      ),
    };
  }

  const updated = await db.rateLimitBucket.update({
    where: { key },
    data: { count: { increment: 1 } },
    select: { count: true },
  });

  return { allowed: true, remaining: Math.max(0, limit - updated.count) };
}

export async function checkRateLimit(
  options: RateLimitOptions
): Promise<RateLimitResult> {
  if (useInMemoryRateLimit) {
    return checkRateLimitInMemory(options);
  }

  return checkRateLimitDb(options);
}

export function normalizeRateLimitKey(value: string) {
  return value.trim().toLowerCase().slice(0, 160);
}