import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import {
  DEFAULT_TLD_PRICING_RULES,
  applyRounding,
  buildTldSuggestion,
  maxChangePercent,
  parseTldPricingRules,
  suggestPrice,
  type TldCostRow,
  type TldPricingRules,
} from "./tld-pricing";

const d = (v: string) => new Prisma.Decimal(v);

describe("applyRounding", () => {
  it("rounds up to ,90", () => {
    expect(applyRounding("412.31", "x90").toFixed(2)).toBe("412.90");
    expect(applyRounding("412.95", "x90").toFixed(2)).toBe("413.90");
    expect(applyRounding("412.90", "x90").toFixed(2)).toBe("412.90");
    expect(applyRounding("412", "x90").toFixed(2)).toBe("412.90");
  });

  it("rounds up to ,99", () => {
    expect(applyRounding("99.995", "x99").toFixed(2)).toBe("100.99"); // 99.995 → 100.00 kuruş first
    expect(applyRounding("99.50", "x99").toFixed(2)).toBe("99.99");
  });

  it("rounds up to whole lira and never down", () => {
    expect(applyRounding("412.01", "whole").toFixed(2)).toBe("413.00");
    expect(applyRounding("412.00", "whole").toFixed(2)).toBe("412.00");
  });

  it("rounds half-up to kuruş with 'none'", () => {
    expect(applyRounding("10.005", "none").toFixed(2)).toBe("10.01");
  });
});

describe("suggestPrice", () => {
  const rules = { marginPercent: 30, marginFixedTry: 0, rounding: "none" as const };

  it("converts the cost with the rate and adds the percentage margin", () => {
    // 10.99 USD × 41.7278 = 458.588522 → ×1.30 = 596.165078… → 596.17
    expect(suggestPrice("10.99", "41.7278", rules)?.toFixed(2)).toBe("596.17");
  });

  it("adds a fixed TRY margin after the percentage, then rounds", () => {
    expect(suggestPrice("10", "40", { marginPercent: 10, marginFixedTry: 25, rounding: "x90" })?.toFixed(2)).toBe("465.90");
    expect(suggestPrice("10", "40", { marginPercent: 0, marginFixedTry: 25, rounding: "whole" })?.toFixed(2)).toBe("425.00");
  });

  it("returns null without a cost", () => {
    expect(suggestPrice(null, "40", rules)).toBeNull();
    expect(suggestPrice("0", "40", rules)).toBeNull();
  });
});

describe("buildTldSuggestion", () => {
  const rules: TldPricingRules = { ...DEFAULT_TLD_PRICING_RULES, marginPercent: 20, marginFixedTry: 0, rounding: "x90" };
  const tld: TldCostRow = {
    id: "t1",
    ext: ".com",
    isActive: true,
    registerPrice: d("449.90"),
    renewPrice: d("499.00"),
    transferPrice: d("449.90"),
    costRegister: d("9.00"),
    costRenew: d("10.00"),
    costTransfer: null,
    costCurrency: "USD",
  };
  const rates = [{ currency: "USD", date: "2026-10-09", buying: d("41"), selling: d("41.6528") }];

  it("suggests register/renew prices from the latest prior rate and keeps lines without a cost", () => {
    const s = buildTldSuggestion(tld, rates, "2026-10-11", rules);
    // 9 × 41.6528 = 374.8752 × 1.2 = 449.85024 → 449.90 (unchanged)
    expect(s.lines.register.suggested?.toFixed(2)).toBe("449.90");
    expect(s.lines.register.delta?.isZero()).toBe(true);
    // 10 × 41.6528 × 1.2 = 499.8336 → 499.90 (+0.90)
    expect(s.lines.renew.suggested?.toFixed(2)).toBe("499.90");
    expect(s.lines.renew.delta?.toFixed(2)).toBe("0.90");
    expect(s.lines.transfer.suggested).toBeNull();
    expect(s.changed).toBe(true);
    expect(s.rate?.fallback).toBe(true);
    expect(s.lines.register.costTry?.toFixed(2)).toBe("374.88");
  });

  it("has no suggestion when the cost currency has no rate", () => {
    const s = buildTldSuggestion({ ...tld, costCurrency: "EUR" }, rates, "2026-10-11", rules);
    expect(s.rate).toBeNull();
    expect(s.changed).toBe(false);
  });

  it("measures the largest change for the auto-apply guard", () => {
    const s = buildTldSuggestion({ ...tld, renewPrice: d("250") }, rates, "2026-10-11", rules);
    expect(maxChangePercent(s).toDecimalPlaces(2).toString()).toBe("99.96");
  });
});

describe("parseTldPricingRules", () => {
  it("defaults to auto-apply OFF for missing or invalid settings", () => {
    expect(parseTldPricingRules(null).autoApply).toBe(false);
    expect(parseTldPricingRules("{bad json").autoApply).toBe(false);
    expect(parseTldPricingRules(JSON.stringify({ autoApply: true })).autoApply).toBe(false);
  });

  it("reads a stored rule", () => {
    const rules = parseTldPricingRules(
      JSON.stringify({ marginPercent: 25, marginFixedTry: 10, rounding: "whole", autoApply: true, updatedBy: "u1" })
    );
    expect(rules).toMatchObject({ marginPercent: 25, marginFixedTry: 10, rounding: "whole", autoApply: true, updatedBy: "u1" });
  });
});
