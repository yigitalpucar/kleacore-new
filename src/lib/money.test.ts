import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  add,
  allocate,
  compare,
  div,
  formatMoney,
  money,
  mul,
  parseMoney,
  percent,
  roundHalfUp,
  serializeMoney,
  sub,
  sum,
  toFixed2,
  toKurus,
  toNumber,
} from "./money";
import { calculateInvoiceTotals } from "./billing/invoice-totals";
import { calculateTax } from "./billing/tax";
import { formatTRY } from "./format/price";

vi.mock("@/lib/db", () => ({ db: {} }));

describe("money", () => {
  it("adds 0.1 + 0.2 exactly", () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the float bug this module exists for
    expect(add(0.1, 0.2).toString()).toBe("0.3");
    expect(add(0.1, 0.2).equals(new Prisma.Decimal("0.3"))).toBe(true);
    expect(toNumber(add(0.1, 0.2))).toBe(0.3);
  });

  it("sums many small amounts without drift", () => {
    const tenths = Array.from({ length: 1000 }, () => 0.1);
    expect(tenths.reduce((a, b) => a + b, 0)).not.toBe(100);
    expect(sum(tenths).toString()).toBe("100");
  });

  it("rounds half-up to kuruş where toFixed rounds down", () => {
    expect(Number((1.005).toFixed(2))).toBe(1); // float: 1.00499999…
    expect(roundHalfUp(1.005).toFixed(2)).toBe("1.01");
    expect(roundHalfUp("2.675").toFixed(2)).toBe("2.68");
    expect(roundHalfUp("0.125").toFixed(2)).toBe("0.13");
    expect(roundHalfUp("0.124").toFixed(2)).toBe("0.12");
    expect(roundHalfUp("-1.005").toFixed(2)).toBe("-1.01");
    expect(roundHalfUp("10").toFixed(2)).toBe("10.00");
  });

  it("computes KDV with half-up rounding", () => {
    expect(percent(1000, 20).toFixed(2)).toBe("200.00");
    expect(percent("0.025", 20).toFixed(2)).toBe("0.01"); // 0.005 -> 0.01
    expect(percent("10.05", 20).toFixed(2)).toBe("2.01"); // 2.01 exactly
    expect(percent("12.34", 18).toFixed(2)).toBe("2.22"); // 2.2212
    expect(percent("1.25", 20).toFixed(2)).toBe("0.25");
  });

  it("does sub/mul/div/compare on mixed inputs", () => {
    expect(sub("100.10", 0.1).toString()).toBe("100");
    expect(mul("39", 12).toString()).toBe("468");
    expect(div(100, 3).toDecimalPlaces(2).toString()).toBe("33.33");
    expect(div(100, 0).toString()).toBe("0");
    expect(compare("10.00", 10)).toBe(0);
    expect(compare(new Prisma.Decimal("9.99"), 10)).toBe(-1);
    expect(compare(null, -1)).toBe(1);
  });

  it("treats nullish / invalid input as zero", () => {
    expect(money(null).toString()).toBe("0");
    expect(money(undefined).toString()).toBe("0");
    expect(money("").toString()).toBe("0");
    expect(money(Number.NaN).toString()).toBe("0");
    expect(money("abc").toString()).toBe("0");
  });

  it("converts at the boundary", () => {
    expect(toNumber(new Prisma.Decimal("1234.565"))).toBe(1234.57);
    expect(toFixed2(49)).toBe("49.00");
    expect(toKurus("19.99")).toBe(1999);
    expect(toKurus(0.1 + 0.2)).toBe(30);
    expect(formatMoney(new Prisma.Decimal("1299"))).toBe(formatTRY(1299));
    expect(formatMoney("99.99")).toBe(formatTRY(99.99));
    expect(formatMoney("1.005", { keepDecimals: true })).toBe(formatTRY(1.01, { keepDecimals: true }));
  });

  it("parses Turkish and English formatted user input", () => {
    expect(parseMoney("1.234,56")?.toString()).toBe("1234.56");
    expect(parseMoney("1234,56")?.toString()).toBe("1234.56");
    expect(parseMoney("1234.56")?.toString()).toBe("1234.56");
    expect(parseMoney("₺1,234.56")?.toString()).toBe("1234.56");
    expect(parseMoney("1 234,50 ₺")?.toString()).toBe("1234.5");
    expect(parseMoney("1.234.567")?.toString()).toBe("1234567");
    expect(parseMoney("12,5")?.toString()).toBe("12.5");
    expect(parseMoney("-5")?.toString()).toBe("-5");
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("on iki")).toBeNull();
    expect(parseMoney(null)).toBeNull();
  });

  it("allocates an amount so the parts add up exactly", () => {
    const parts = allocate(100, [1, 1, 1]);
    expect(parts.map((p) => p.toFixed(2))).toEqual(["33.34", "33.33", "33.33"]);
    expect(sum(parts).toFixed(2)).toBe("100.00");
    expect(allocate(10, [0, 0]).map((p) => p.toString())).toEqual(["10", "0"]);
    expect(allocate(5, [])).toEqual([]);
  });

  it("serializes Decimals deep inside Prisma-like results", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const row = {
      id: "inv_1",
      totalAmount: new Prisma.Decimal("120.50"),
      refundAmount: null,
      createdAt,
      items: [{ unitPrice: new Prisma.Decimal("0.30"), quantity: 2 }],
    };
    const out = serializeMoney(row);
    expect(out).toEqual({
      id: "inv_1",
      totalAmount: 120.5,
      refundAmount: null,
      createdAt,
      items: [{ unitPrice: 0.3, quantity: 2 }],
    });
    expect(out.createdAt).toBeInstanceOf(Date);
  });
});

describe("kuruş acceptance (roadmap 1.1)", () => {
  it("0,1 + 0,2 typed amounts give a 0,30 subtotal and 0,36 total", () => {
    const totals = calculateInvoiceTotals(
      [
        { quantity: 1, unitPrice: 0.1 },
        { quantity: 1, unitPrice: 0.2 },
      ],
      20
    );
    expect(totals.subtotal.toFixed(2)).toBe("0.30");
    expect(totals.taxAmount.toFixed(2)).toBe("0.06");
    expect(totals.totalAmount.toFixed(2)).toBe("0.36");
  });

  it("an invoice of 1.000 lines at %20 KDV: invoice totals equal the line totals", () => {
    // Prices chosen to hit float trouble: x.x5 / x.x05 ties and tenths.
    const lines = Array.from({ length: 1000 }, (_, i) => ({
      quantity: (i % 3) + 1,
      unitPrice: [0.1, 0.2, 1.005, 19.99, 33.335, 49.95, 0.05][i % 7],
    }));

    const totals = calculateInvoiceTotals(lines, 20);

    // Net: invoice subtotal == Σ line totals, each line rounded to kuruş.
    expect(totals.lines).toHaveLength(1000);
    expect(totals.subtotal.equals(sum(totals.lines.map((l) => l.totalPrice)))).toBe(true);

    // KDV: per-line tax shares add up to the invoice KDV, and each line's
    // gross adds up to the invoice total (what an e-fatura validator checks).
    expect(sum(totals.lines.map((l) => l.taxAmount)).equals(totals.taxAmount)).toBe(true);
    expect(
      sum(totals.lines.map((l) => l.totalPrice.plus(l.taxAmount))).equals(totals.totalAmount)
    ).toBe(true);

    // total == subtotal + tax, tax == 20 % of subtotal rounded half-up.
    expect(totals.totalAmount.equals(totals.subtotal.plus(totals.taxAmount))).toBe(true);
    expect(totals.taxAmount.equals(percent(totals.subtotal, 20))).toBe(true);

    // Everything is whole kuruş.
    for (const value of [totals.subtotal, totals.taxAmount, totals.totalAmount]) {
      expect(value.decimalPlaces()).toBeLessThanOrEqual(2);
    }

    // And the old float pipeline would not have matched to the kuruş.
    const floatSubtotal = lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0);
    expect(floatSubtotal.toFixed(10)).not.toBe(totals.subtotal.toFixed(10));
  });

  it("calculateTax keeps its number interface but rounds half-up", () => {
    // 0.025 × 20 % = 0.005 -> 0.01 (float toFixed gave 0.01 or 0.00 by luck)
    expect(calculateTax(0.03, 20)).toEqual({
      subtotal: 0.03,
      taxRate: 20,
      taxAmount: 0.01,
      totalAmount: 0.04,
    });
    expect(calculateTax(1000, 20).totalAmount).toBe(1200);
    expect(calculateTax(0.1 + 0.2).subtotal).toBe(0.3);
  });
});
