import { describe, expect, it } from "vitest";
import { daysInRange, monthBounds, monthsInRange, parseReportRange, rangeForPeriod } from "./range";

const now = new Date("2026-10-08T10:00:00Z");

describe("parseReportRange", () => {
  it("uses Istanbul day boundaries for a custom range", () => {
    const range = parseReportRange({ from: "2026-09-01", to: "2026-09-30" }, now);
    expect(range.period).toBe("custom");
    expect(range.from.toISOString()).toBe("2026-08-31T21:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-09-30T20:59:59.999Z");
  });

  it("swaps reversed dates, caps at today and ignores invalid dates", () => {
    const swapped = parseReportRange({ from: "2026-12-31", to: "2026-10-01" }, now);
    expect([swapped.fromDay, swapped.toDay]).toEqual(["2026-10-01", "2026-10-08"]);
    expect(swapped.to).toBe(now);
    expect(parseReportRange({ from: "2026-02-30", to: "2026-03-01" }, now).period).toBe("6months");
  });

  it("falls back to the preset period", () => {
    const range = parseReportRange(new URLSearchParams("period=3months"), now);
    expect(range.fromDay).toBe("2026-08-01");
    expect(rangeForPeriod("7days", now).fromDay).toBe("2026-10-02");
  });
});

describe("month helpers", () => {
  it("lists months across a year boundary", () => {
    expect(monthsInRange({ fromDay: "2025-11-15", toDay: "2026-02-01" })).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(daysInRange({ fromDay: "2026-02-27", toDay: "2026-03-01" })).toEqual(["2026-02-27", "2026-02-28", "2026-03-01"]);
  });

  it("gives Istanbul month bounds", () => {
    const { start, end } = monthBounds("2026-12");
    expect(start.toISOString()).toBe("2026-11-30T21:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T21:00:00.000Z");
  });
});
