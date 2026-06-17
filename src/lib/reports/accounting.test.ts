import { describe, expect, it } from "vitest";
import {
  calculateAccountingSummary,
  groupMonthlyTaxBreakdown,
  roundMoney,
} from "./accounting";

describe("roundMoney", () => {
  it("rounds monetary values to two decimals", () => {
    expect(roundMoney(10.456)).toBe(10.46);
    expect(roundMoney(99.994)).toBe(99.99);
    expect(roundMoney(100)).toBe(100);
  });
});

describe("calculateAccountingSummary", () => {
  it("aggregates paid invoice totals and payment methods", () => {
    const summary = calculateAccountingSummary(
      [
        { subtotal: 100, taxAmount: 20, totalAmount: 120 },
        { subtotal: 50, taxAmount: 10, totalAmount: 60 },
      ],
      [
        { method: "CREDIT_CARD", amount: 120 },
        { method: "BANK_TRANSFER", amount: 40 },
        { method: "BALANCE", amount: 20 },
      ],
      [
        { status: "PENDING", totalAmount: 80 },
        { status: "OVERDUE", totalAmount: 45 },
      ],
      [{ totalAmount: 30 }]
    );

    expect(summary).toEqual({
      grossRevenue: 180,
      netRevenue: 150,
      totalTax: 30,
      collectedByMethod: {
        CREDIT_CARD: 120,
        BANK_TRANSFER: 40,
        BALANCE: 20,
      },
      outstanding: 125,
      overdueCount: 1,
      pendingCount: 1,
      refunds: {
        count: 1,
        sum: 30,
      },
    });
  });

  it("returns zeroed values when there is no data", () => {
    const summary = calculateAccountingSummary([], [], [], []);

    expect(summary).toEqual({
      grossRevenue: 0,
      netRevenue: 0,
      totalTax: 0,
      collectedByMethod: {
        CREDIT_CARD: 0,
        BANK_TRANSFER: 0,
        BALANCE: 0,
      },
      outstanding: 0,
      overdueCount: 0,
      pendingCount: 0,
      refunds: {
        count: 0,
        sum: 0,
      },
    });
  });
});

describe("groupMonthlyTaxBreakdown", () => {
  it("groups paid invoices by month and sums subtotal, tax and total", () => {
    const rows = groupMonthlyTaxBreakdown([
      {
        paidAt: new Date("2025-01-15T10:00:00.000Z"),
        subtotal: 100,
        taxAmount: 20,
        totalAmount: 120,
      },
      {
        paidAt: new Date("2025-01-28T10:00:00.000Z"),
        subtotal: 50,
        taxAmount: 10,
        totalAmount: 60,
      },
      {
        paidAt: new Date("2025-02-10T10:00:00.000Z"),
        subtotal: 200,
        taxAmount: 40,
        totalAmount: 240,
      },
    ]);

    expect(rows).toEqual([
      {
        month: "2025-01",
        label: "Ocak 2025",
        subtotal: 150,
        tax: 30,
        total: 180,
      },
      {
        month: "2025-02",
        label: "Şubat 2025",
        subtotal: 200,
        tax: 40,
        total: 240,
      },
    ]);
  });

  it("skips invoices without paidAt", () => {
    const rows = groupMonthlyTaxBreakdown([
      {
        paidAt: null,
        subtotal: 100,
        taxAmount: 20,
        totalAmount: 120,
      },
    ]);

    expect(rows).toEqual([]);
  });
});