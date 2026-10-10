import { describe, expect, it } from "vitest";
import { buildPackageComparison, packagePrices, savingsSummary, type ComparableProduct } from "./package-comparison";

function product(over: Partial<ComparableProduct> & { sku: string }): ComparableProduct {
  return {
    slug: over.sku.toLowerCase(),
    name: over.sku,
    isPopular: false,
    basePrice: 0,
    features: [],
    includedFeatures: [],
    pricingTiers: [],
    ...over,
  };
}

describe("packagePrices", () => {
  it("uses the discounted tier price like checkout and floors the saving", () => {
    const p = product({
      sku: "VDS-1",
      basePrice: 99.99,
      pricingTiers: [
        { period: "monthly", price: 99.99, discountedPrice: 99.99 },
        { period: "yearly", price: 90, discountedPrice: 83.99 },
      ],
    });
    expect(packagePrices(p)).toEqual({ monthlyPrice: 99.99, yearlyMonthlyPrice: 83.99, savingsPercent: 16 });
  });

  it("reports no saving when yearly is exactly 12 × monthly", () => {
    const p = product({
      sku: "X",
      pricingTiers: [
        { period: "monthly", price: 100 },
        { period: "yearly", price: 100 },
      ],
    });
    expect(packagePrices(p).savingsPercent).toBe(0);
  });

  it("reports no saving when yearly is dearer, and ignores inactive tiers", () => {
    const dearer = product({
      sku: "A",
      pricingTiers: [
        { period: "monthly", price: 50 },
        { period: "yearly", price: 55 },
      ],
    });
    expect(packagePrices(dearer).savingsPercent).toBe(0);

    const inactive = product({
      sku: "B",
      basePrice: 70,
      pricingTiers: [{ period: "yearly", price: 10, isActive: false }],
    });
    expect(packagePrices(inactive)).toEqual({ monthlyPrice: 70, yearlyMonthlyPrice: null, savingsPercent: 0 });
  });
});

describe("buildPackageComparison", () => {
  const products = [
    product({
      sku: "S",
      features: [
        { label: "Disk", value: "1 GB", icon: "HardDrive" },
        { label: "SSL", value: "✓" },
      ],
      includedFeatures: ["cPanel", "Haftalık Yedekleme", "%99.9 Uptime"],
    }),
    product({
      sku: "P",
      isPopular: true,
      features: [
        { label: "Disk", value: "5 GB" },
        { label: "Trafik", value: "25 GB" },
      ],
      includedFeatures: ["cPanel", "Günlük Yedekleme"],
    }),
  ];

  it("builds columns from the DB flag and rows from features + included items", () => {
    const data = buildPackageComparison(products);
    expect(data.columns.map((c) => [c.key, c.featured])).toEqual([
      ["S", false],
      ["P", true],
    ]);
    expect(data.rows.map((r) => [r.group, r.label])).toEqual([
      ["features", "Disk"],
      ["features", "SSL"],
      ["features", "Trafik"],
      ["included", "cPanel"],
      ["included", "Haftalık Yedekleme"],
      ["included", "Günlük Yedekleme"],
    ]);
    expect(data.rows[0]).toMatchObject({ icon: "HardDrive", values: { S: "1 GB", P: "5 GB" } });
    expect(data.rows[1].values).toEqual({ S: true, P: null });
    expect(data.rows[2].values).toEqual({ S: null, P: "25 GB" });
    expect(data.rows[4].values).toEqual({ S: true, P: false });
  });

  it("never lists unverifiable uptime/SLA claims", () => {
    const labels = buildPackageComparison(products).rows.map((r) => r.label);
    expect(labels.some((l) => /uptime/i.test(l))).toBe(false);
  });

  it("tolerates malformed JSON columns", () => {
    const data = buildPackageComparison([product({ sku: "Z", features: { bad: true }, includedFeatures: "x" })]);
    expect(data.rows).toEqual([]);
  });
});

describe("savingsSummary", () => {
  it("hides the badge when no package saves", () => {
    expect(savingsSummary([{ savingsPercent: 0 }, { savingsPercent: 0 }])).toEqual({ max: 0, uniform: true });
  });
  it("is uniform only when every package saves the same", () => {
    expect(savingsSummary([{ savingsPercent: 16 }, { savingsPercent: 16 }])).toEqual({ max: 16, uniform: true });
    expect(savingsSummary([{ savingsPercent: 16 }, { savingsPercent: 20 }])).toEqual({ max: 20, uniform: false });
    expect(savingsSummary([{ savingsPercent: 16 }, { savingsPercent: 0 }])).toEqual({ max: 16, uniform: false });
  });
});
