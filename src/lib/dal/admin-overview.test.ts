import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));
const groupBy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { invoice: { groupBy } } }));

import { cacheMinute, fillDays, istanbulPeriodStarts, loadPastDueReceivables } from "./admin-overview";
import { pastDueInvoiceWhere } from "@/lib/billing/past-due";

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

describe("past-due receivables (dashboard card)", () => {
  const now = new Date("2026-10-10T12:00:00Z");

  it("counts OVERDUE invoices and PENDING ones past their due date", () => {
    expect(pastDueInvoiceWhere(now)).toEqual({
      OR: [{ status: "OVERDUE" }, { status: "PENDING", dueDate: { lt: now } }],
    });
  });

  it("sums the remaining amount of both and reports each count", async () => {
    groupBy.mockResolvedValueOnce([
      { status: "OVERDUE", _sum: { totalAmount: "1200.00", paidAmount: "200.00" }, _count: { _all: 3 } },
      { status: "PENDING", _sum: { totalAmount: "240.00", paidAmount: null }, _count: { _all: 2 } },
    ]);
    const result = await loadPastDueReceivables(now);
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({ by: ["status"], where: pastDueInvoiceWhere(now) }));
    expect(result).toEqual({ amount: "1240.00", count: 5, overdueCount: 3, pendingPastDueCount: 2 });
  });

  it("is zero when nothing is past due", async () => {
    groupBy.mockResolvedValueOnce([]);
    expect(await loadPastDueReceivables(now)).toEqual({ amount: "0.00", count: 0, overdueCount: 0, pendingPastDueCount: 0 });
  });
});
