import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { computeDomainMargins, matchTld } from "./domain-margin";

const d = (v: string) => new Prisma.Decimal(v);

describe("computeDomainMargins", () => {
  const tlds = [
    { ext: ".com", costRegister: d("10"), costRenew: d("12"), costTransfer: d("10"), costCurrency: "USD" },
    { ext: ".com.tr", costRegister: d("150"), costRenew: d("150"), costTransfer: null, costCurrency: "TRY" },
    { ext: ".io", costRegister: null, costRenew: null, costTransfer: null, costCurrency: "USD" },
  ];
  const rates = [
    { currency: "USD", date: "2026-10-02", buying: d("41"), selling: d("41.50") },
    { currency: "USD", date: "2026-10-05", buying: d("41"), selling: d("42.00") },
  ];
  const sale = (over: Partial<Parameters<typeof computeDomainMargins>[0][number]>) => ({
    invoiceId: "i",
    invoiceNumber: "F-1",
    paidAt: new Date("2026-10-04T10:00:00Z"),
    domain: "ornek.com",
    kind: "register" as const,
    years: 1,
    sale: d("600"),
    tld: ".com",
    ...over,
  });

  it("converts the USD cost at the (weekend → Friday) rate of the payment day", () => {
    const { rows } = computeDomainMargins([sale({})], tlds, rates);
    expect(rows[0].rateDay).toBe("2026-10-02");
    expect(rows[0].costTry?.toFixed(2)).toBe("415.00");
    expect(rows[0].margin?.toFixed(2)).toBe("185.00");
    expect(rows[0].marginPercent?.toString()).toBe("30.83");
  });

  it("multiplies by years, derives the TLD of renewals and handles TRY costs", () => {
    const { rows } = computeDomainMargins(
      [
        sale({ kind: "renew", tld: null, domain: "ornek.com", years: 2, sale: d("1100"), paidAt: new Date("2026-10-06T10:00:00Z") }),
        sale({ domain: "firma.com.tr", tld: null, sale: d("199") }),
      ],
      tlds,
      rates
    );
    expect(rows[0].costTry?.toFixed(2)).toBe("1008.00"); // 12 × 2 × 42
    expect(rows[1].tld).toBe(".com.tr");
    expect(rows[1].costTry?.toFixed(2)).toBe("150.00");
  });

  it("flags sales without cost or rate and keeps them out of the margin basis", () => {
    const { rows, summary } = computeDomainMargins(
      [sale({}), sale({ domain: "x.io", tld: ".io" }), sale({ paidAt: new Date("2026-09-01T10:00:00Z") }), sale({ domain: "x.dev", tld: null })],
      tlds,
      rates
    );
    expect(rows.map((r) => r.issue)).toEqual([null, "NO_COST", "NO_RATE", "NO_TLD"]);
    expect(summary.revenue.toFixed(2)).toBe("2400.00");
    expect(summary.costedRevenue.toFixed(2)).toBe("600.00");
    expect(summary.uncosted).toBe(3);
    expect(summary.marginPercent?.toString()).toBe("30.83");
  });

  it("matches the longest TLD", () => {
    expect(matchTld("a.com.tr", [".tr", ".com.tr", ".com"])).toBe(".com.tr");
    expect(matchTld("a.net", [".com"])).toBeNull();
  });
});
