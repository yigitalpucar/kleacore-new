import { describe, expect, it } from "vitest";
import {
  addonPeriodTotal,
  monthlyEquivalent,
  periodMonths,
  periodTotal,
  priceBasisForCategory,
  priceBasisForItemType,
} from "./period-price";

describe("priceBasisForCategory", () => {
  it.each(["hosting", "vps", "vds", "cloud", "server", "datacenter"])(
    "treats %s tiers as monthly equivalents",
    (slug) => {
      expect(priceBasisForCategory(slug)).toBe("monthly-equivalent");
    }
  );

  it.each(["domain", "ssl", "email", "unknown", null, undefined])(
    "treats %s tiers as period totals",
    (slug) => {
      expect(priceBasisForCategory(slug)).toBe("period-total");
    }
  );
});

describe("priceBasisForItemType", () => {
  it("maps cart item types", () => {
    expect(priceBasisForItemType("hosting")).toBe("monthly-equivalent");
    expect(priceBasisForItemType("server")).toBe("monthly-equivalent");
    expect(priceBasisForItemType("datacenter")).toBe("monthly-equivalent");
    expect(priceBasisForItemType("domain")).toBe("period-total");
    expect(priceBasisForItemType("ssl")).toBe("period-total");
  });
});

describe("periodTotal", () => {
  it("charges the monthly tier once for a monthly hosting order", () => {
    expect(periodTotal(49, "monthly", "monthly-equivalent")).toBe(49);
  });

  it("charges 12 × the monthly equivalent for a yearly hosting order", () => {
    // Starter: monthly 49, yearly tier 39 (39 ₺/ay billed annually)
    expect(periodTotal(39, "yearly", "monthly-equivalent")).toBe(468);
  });

  it("charges 12 × for yearly servers and rounds to kuruş", () => {
    expect(periodTotal(83.99, "yearly", "monthly-equivalent")).toBe(1007.88);
    expect(periodTotal(2099.17, "yearly", "monthly-equivalent")).toBe(25190.04);
  });

  it("does not multiply domain / SSL period prices", () => {
    expect(periodTotal(179, "yearly", "period-total")).toBe(179);
    expect(periodTotal(99, "yearly", "period-total")).toBe(99);
    expect(periodTotal(549, "biennial", "period-total")).toBe(549);
  });

  it("handles other periods for monthly-equivalent prices", () => {
    expect(periodTotal(10, "quarterly", "monthly-equivalent")).toBe(30);
    expect(periodTotal(10, "biennial", "monthly-equivalent")).toBe(240);
  });

  it("returns 0 for non-numeric input", () => {
    expect(periodTotal(Number.NaN, "yearly", "monthly-equivalent")).toBe(0);
  });
});

describe("addonPeriodTotal", () => {
  const backup = { monthlyPrice: 29, yearlyPrice: 24 };

  it("uses the monthly addon price for monthly orders", () => {
    expect(addonPeriodTotal(backup, "monthly")).toBe(29);
  });

  it("charges 12 × the yearly monthly-equivalent for yearly orders", () => {
    expect(addonPeriodTotal(backup, "yearly")).toBe(288);
  });

  it("accepts Decimal-like strings", () => {
    expect(addonPeriodTotal({ monthlyPrice: "59", yearlyPrice: "49" }, "yearly")).toBe(588);
  });
});

describe("helpers", () => {
  it("periodMonths falls back to 1 month", () => {
    expect(periodMonths("yearly")).toBe(12);
    expect(periodMonths(undefined)).toBe(1);
    expect(periodMonths("weird")).toBe(1);
  });

  it("monthlyEquivalent divides a period total back", () => {
    expect(monthlyEquivalent(468, "yearly")).toBe(39);
    expect(monthlyEquivalent(49, "monthly")).toBe(49);
  });
});
