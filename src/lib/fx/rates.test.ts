import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { istanbulDay, pickRate, type RateRow } from "./rates";

const d = (v: string) => new Prisma.Decimal(v);
const rows: RateRow[] = [
  { currency: "USD", date: "2026-10-08", buying: d("41.60"), selling: d("41.70") }, // Thursday
  { currency: "USD", date: "2026-10-09", buying: d("41.80"), selling: d("41.90") }, // Friday
  { currency: "EUR", date: "2026-10-12", buying: d("48.00"), selling: d("48.10") },
  { currency: "USD", date: "2026-10-12", buying: d("42.00"), selling: d("42.10") }, // Monday
];

describe("pickRate", () => {
  it("uses the bulletin of the same day when there is one", () => {
    expect(pickRate(rows, "USD", "2026-10-09")).toEqual({ currency: "USD", rate: d("41.90"), date: "2026-10-09", fallback: false });
  });

  it("falls back to the latest prior bulletin on weekends and holidays", () => {
    const saturday = pickRate(rows, "usd", "2026-10-10");
    const sunday = pickRate(rows, "USD", "2026-10-11");
    expect(saturday?.date).toBe("2026-10-09");
    expect(saturday?.fallback).toBe(true);
    expect(sunday?.rate.toString()).toBe("41.9");
  });

  it("never uses a later bulletin and returns null before the first one", () => {
    expect(pickRate(rows, "USD", "2026-10-07")).toBeNull();
    expect(pickRate(rows, "EUR", "2026-10-11")).toBeNull();
  });

  it("can read the buying side", () => {
    expect(pickRate(rows, "USD", "2026-10-12", "buying")?.rate.toString()).toBe("42");
  });

  it("resolves TRY to 1 without any rows", () => {
    expect(pickRate([], "TRY", "2026-10-11")?.rate.toString()).toBe("1");
  });
});

describe("istanbulDay", () => {
  it("uses the Istanbul calendar day (UTC+3)", () => {
    expect(istanbulDay(new Date("2026-10-08T21:30:00Z"))).toBe("2026-10-09");
    expect(istanbulDay(new Date("2026-10-08T20:59:00Z"))).toBe("2026-10-08");
  });
});
