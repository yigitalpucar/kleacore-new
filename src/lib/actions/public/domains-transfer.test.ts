import { describe, expect, it } from "vitest";
import {
  calculateDomainTransferPricing,
  matchDomainTld,
} from "@/lib/domains/transfer-pricing";

describe("matchDomainTld", () => {
  const tlds = [
    { ext: ".com", transferPrice: 149 },
    { ext: ".com.tr", transferPrice: 99 },
    { ext: ".net", transferPrice: 179 },
  ];

  it("matches the longest TLD extension first", () => {
    expect(matchDomainTld("ornek.com.tr", tlds)?.ext).toBe(".com.tr");
    expect(matchDomainTld("ornek.com", tlds)?.ext).toBe(".com");
    expect(matchDomainTld("ornek.net", tlds)?.ext).toBe(".net");
  });

  it("returns null when no TLD matches", () => {
    expect(matchDomainTld("ornek.xyz", tlds)).toBeNull();
    expect(matchDomainTld("", tlds)).toBeNull();
  });

  it("normalizes domain casing before matching", () => {
    expect(matchDomainTld("ORNEK.COM", tlds)?.transferPrice).toBe(149);
  });
});

describe("calculateDomainTransferPricing", () => {
  it("calculates subtotal, tax and total for transfer price", () => {
    expect(calculateDomainTransferPricing(149, 20)).toEqual({
      subtotal: 149,
      taxRate: 20,
      taxAmount: 29.8,
      totalAmount: 178.8,
    });
  });

  it("rounds monetary values to two decimals", () => {
    expect(calculateDomainTransferPricing(99.99, 18)).toEqual({
      subtotal: 99.99,
      taxRate: 18,
      taxAmount: 18,
      totalAmount: 117.99,
    });
  });

  it("uses transfer price from matched TLD", () => {
    const tlds = [
      { ext: ".com", transferPrice: 149 },
      { ext: ".io", transferPrice: 499 },
    ];

    const domain = "startup.io";
    const tld = matchDomainTld(domain, tlds);
    const pricing = calculateDomainTransferPricing(tld!.transferPrice, 20);

    expect(pricing.subtotal).toBe(499);
    expect(pricing.totalAmount).toBe(598.8);
  });
});