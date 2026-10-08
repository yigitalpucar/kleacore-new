import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { computeKdvReport, splitGross } from "./kdv";

describe("splitGross", () => {
  it("splits a KDV-inclusive refund at the invoice rate, half-up to the kuruş", () => {
    expect(splitGross(120, 20)).toEqual({ base: expect.anything(), tax: expect.anything() });
    const full = splitGross(120, 20);
    expect([full.base.toString(), full.tax.toString()]).toEqual(["100", "20"]);
    const odd = splitGross("100.01", 20); // 16.6683… → 16.67
    expect([odd.base.toFixed(2), odd.tax.toFixed(2)]).toEqual(["83.34", "16.67"]);
  });
});

describe("computeKdvReport", () => {
  const months = ["2026-08", "2026-09", "2026-10"];
  const sales = [
    { month: "2026-08", invoices: 2, base: "1000.00", tax: "200.00", total: "1200.00" },
    { month: "2026-09", invoices: 1, base: "250.00", tax: "50.00", total: "300.00" },
  ];
  const refunds = [
    // Full refund in September of an August invoice (120 incl. KDV).
    { month: "2026-09", amount: "120.00", taxRate: "20" },
    // Partial refund in October.
    { month: "2026-10", amount: "60.00", taxRate: "20" },
  ];
  const report = computeKdvReport(months, sales, refunds);
  const row = (m: string) => report.rows.find((r) => r.month === m)!;

  it("keeps sales in their payment month and subtracts refunds in the refund month", () => {
    expect(row("2026-08").netBase.toFixed(2)).toBe("1000.00");
    expect(row("2026-08").netTax.toFixed(2)).toBe("200.00");
    expect(row("2026-09").refundBase.toFixed(2)).toBe("100.00");
    expect(row("2026-09").refundTax.toFixed(2)).toBe("20.00");
    expect(row("2026-09").netBase.toFixed(2)).toBe("150.00");
    expect(row("2026-09").netTax.toFixed(2)).toBe("30.00");
  });

  it("zero-fills months without sales; a refund-only month goes negative", () => {
    expect(row("2026-10").invoices).toBe(0);
    expect(row("2026-10").netBase.toFixed(2)).toBe("-50.00");
    expect(row("2026-10").netTax.toFixed(2)).toBe("-10.00");
  });

  it("totals the period", () => {
    expect(report.total.invoices).toBe(3);
    expect(report.total.refunds).toBe(2);
    expect(report.total.salesTax.toFixed(2)).toBe("250.00");
    expect(report.total.netBase.toFixed(2)).toBe("1100.00");
    expect(report.total.netTax.toFixed(2)).toBe("220.00");
  });
});
