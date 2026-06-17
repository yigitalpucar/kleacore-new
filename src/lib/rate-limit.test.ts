import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, normalizeRateLimitKey } from "./rate-limit";

describe("normalizeRateLimitKey", () => {
  it("trims, lowercases, and caps key length", () => {
    const longKey = "  USER@Example.COM  " + "x".repeat(200);

    expect(normalizeRateLimitKey(longKey)).toBe(
      ("user@example.com  " + "x".repeat(200)).slice(0, 160)
    );
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request and reports remaining quota", async () => {
    const result = await checkRateLimit({
      key: "login:alice",
      limit: 3,
      windowMs: 60_000,
    });

    expect(result).toEqual({
      allowed: true,
      remaining: 2,
    });
  });

  it("blocks requests after the limit is exceeded within the window", async () => {
    const options = {
      key: "login:bob",
      limit: 2,
      windowMs: 60_000,
    };

    expect((await checkRateLimit(options)).allowed).toBe(true);
    expect((await checkRateLimit(options)).allowed).toBe(true);

    const blocked = await checkRateLimit(options);

    expect(blocked).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 60,
    });
  });

  it("resets the bucket after the window expires", async () => {
    const options = {
      key: "login:carol",
      limit: 1,
      windowMs: 1_000,
    };

    expect((await checkRateLimit(options)).allowed).toBe(true);
    expect((await checkRateLimit(options)).allowed).toBe(false);

    vi.advanceTimersByTime(1_001);

    expect(await checkRateLimit(options)).toEqual({
      allowed: true,
      remaining: 0,
    });
  });

  it("tracks separate keys independently", async () => {
    const options = { limit: 1, windowMs: 60_000 };

    expect((await checkRateLimit({ ...options, key: "a" })).allowed).toBe(true);
    expect((await checkRateLimit({ ...options, key: "b" })).allowed).toBe(true);
    expect((await checkRateLimit({ ...options, key: "a" })).allowed).toBe(false);
    expect((await checkRateLimit({ ...options, key: "b" })).allowed).toBe(false);
  });
});