import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));
vi.mock("@/lib/db", () => ({ db: {} }));

import { cacheMinute, fillDays, istanbulPeriodStarts } from "./admin-overview";

describe("admin overview helpers", () => {
  it("fills missing Istanbul days with zero, oldest first", () => {
    expect(fillDays([{ day: "2026-10-09", value: 12.5 }], "2026-10-08", "2026-10-10")).toEqual([
      { day: "2026-10-08", value: 0 },
      { day: "2026-10-09", value: 12.5 },
      { day: "2026-10-10", value: 0 },
    ]);
  });

  it("uses Istanbul day/month starts (UTC+3)", () => {
    // 22:30 UTC on 31 Oct is already 1 Nov in Istanbul.
    const { dayStart, monthStart, today } = istanbulPeriodStarts(new Date("2026-10-31T22:30:00Z"));
    expect(today).toBe("2026-11-01");
    expect(dayStart.toISOString()).toBe("2026-10-31T21:00:00.000Z");
    expect(monthStart.toISOString()).toBe("2026-10-31T21:00:00.000Z");
  });

  it("rounds the cache key to the minute", () => {
    expect(cacheMinute(new Date("2026-10-10T10:15:42.123Z"))).toBe("2026-10-10T10:15:00.000Z");
  });
});
