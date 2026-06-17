import { describe, expect, it } from "vitest";
import { getNextRetryAt, getRetryDelayMs } from "./retry-queue";

describe("provisioning retry backoff", () => {
  it("uses exponential delays of 5m, 15m, 1h, 4h, and 24h", () => {
    expect(getRetryDelayMs(0)).toBe(5 * 60 * 1000);
    expect(getRetryDelayMs(1)).toBe(15 * 60 * 1000);
    expect(getRetryDelayMs(2)).toBe(60 * 60 * 1000);
    expect(getRetryDelayMs(3)).toBe(4 * 60 * 60 * 1000);
    expect(getRetryDelayMs(4)).toBe(24 * 60 * 60 * 1000);
  });

  it("clamps attempts beyond the schedule to the final delay", () => {
    expect(getRetryDelayMs(99)).toBe(24 * 60 * 60 * 1000);
  });

  it("schedules the next retry from the provided timestamp", () => {
    const base = new Date("2026-06-17T12:00:00.000Z");

    expect(getNextRetryAt(0, base).toISOString()).toBe("2026-06-17T12:05:00.000Z");
    expect(getNextRetryAt(1, base).toISOString()).toBe("2026-06-17T12:15:00.000Z");
    expect(getNextRetryAt(2, base).toISOString()).toBe("2026-06-17T13:00:00.000Z");
    expect(getNextRetryAt(3, base).toISOString()).toBe("2026-06-17T16:00:00.000Z");
    expect(getNextRetryAt(4, base).toISOString()).toBe("2026-06-18T12:00:00.000Z");
  });
});