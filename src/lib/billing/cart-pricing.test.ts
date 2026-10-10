import { describe, expect, it } from "vitest";
import { allocateCartLines } from "./cart-pricing";
import { toNumber } from "@/lib/money";

const plain = (lines: ReturnType<typeof allocateCartLines>) =>
  lines.map((line) => ({
    lineTotal: toNumber(line.lineTotal),
    promo: toNumber(line.promoLineDiscount),
    reseller: toNumber(line.resellerLineDiscount),
    payable: toNumber(line.payableLineTotal),
    tax: line.taxed.taxAmount,
    total: line.taxed.totalAmount,
  }));

describe("allocateCartLines", () => {
  it("adds KDV per line without discounts", () => {
    const lines = allocateCartLines(
      [
        { unitPrice: 468, quantity: 1, promoApplies: false },
        { unitPrice: 99.99, quantity: 1, promoApplies: false },
      ],
      { promotion: null, resellerPercent: null, taxRate: 20 }
    );
    expect(plain(lines)).toEqual([
      { lineTotal: 468, promo: 0, reseller: 0, payable: 468, tax: 93.6, total: 561.6 },
      { lineTotal: 99.99, promo: 0, reseller: 0, payable: 99.99, tax: 20, total: 119.99 },
    ]);
  });

  it("spreads the promo over covered lines pro rata, the last one taking the remainder", () => {
    // 10 ₺ over 3 equal lines: 3.33 + 3.33 + 3.34 — sums to the promo exactly.
    const lines = allocateCartLines(
      [
        { unitPrice: 100, quantity: 1, promoApplies: true },
        { unitPrice: 50, quantity: 1, promoApplies: false },
        { unitPrice: 100, quantity: 1, promoApplies: true },
        { unitPrice: 100, quantity: 1, promoApplies: true },
      ],
      { promotion: { discountAmount: 10, applicableTotal: 300 }, resellerPercent: null, taxRate: 20 }
    );
    expect(plain(lines).map((line) => line.promo)).toEqual([3.33, 0, 3.33, 3.34]);
  });

  it("takes the reseller discount from what is left after the promo", () => {
    const [line] = allocateCartLines([{ unitPrice: 200, quantity: 1, promoApplies: true }], {
      promotion: { discountAmount: 20, applicableTotal: 200 },
      resellerPercent: 10,
      taxRate: 20,
    });
    expect(plain([line])[0]).toEqual({ lineTotal: 200, promo: 20, reseller: 18, payable: 162, tax: 32.4, total: 194.4 });
  });

  it("never makes a line negative", () => {
    const [line] = allocateCartLines([{ unitPrice: 10, quantity: 1, promoApplies: true }], {
      promotion: { discountAmount: 10, applicableTotal: 10 },
      resellerPercent: 50,
      taxRate: 20,
    });
    expect(plain([line])[0].total).toBe(0);
  });
});
