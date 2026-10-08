import { describe, expect, it, vi } from "vitest";
import { calculateTax } from "./tax";
import { cartTotals } from "./cart-totals";

vi.mock("@/lib/db", () => ({ db: {} }));

describe("cartTotals", () => {
  it("rounds KDV per line like checkout, so the cart total equals what is charged", () => {
    const lines = [
      { unitPrice: 0.05, quantity: 1 }, // KDV 0.01 (0.010)
      { unitPrice: 0.05, quantity: 1 },
      { unitPrice: 0.05, quantity: 1 },
    ];

    const totals = cartTotals(lines, 20);
    // Checkout: one invoice per line, each calculateTax'ed separately.
    const charged = lines
      .map((line) => calculateTax(line.unitPrice * line.quantity, 20).totalAmount)
      .reduce((a, b) => Math.round((a + b) * 100) / 100, 0);

    expect(totals).toEqual({ subtotal: 0.15, taxAmount: 0.03, total: 0.18 });
    expect(totals.total).toBe(charged);
    // KDV once on the 0.15 subtotal would be 0.03 as well, but on three
    // 0.03 lines it differs: per line 3 × 0.01 = 0.03, on 0.09 it is 0.02.
    const three = Array.from({ length: 3 }, () => ({ unitPrice: "0.03", quantity: 1 }));
    expect(cartTotals(three, 20).taxAmount).toBe(0.03);
  });

  it("adds 0.1 + 0.2 exactly", () => {
    expect(cartTotals([{ unitPrice: 0.1, quantity: 1 }, { unitPrice: 0.2, quantity: 1 }], 20)).toEqual({
      subtotal: 0.3,
      taxAmount: 0.06,
      total: 0.36,
    });
  });
});
