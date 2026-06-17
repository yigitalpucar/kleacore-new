import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    setting: {
      findFirst,
    },
  },
}));

import { calculateTax, clearTaxRateCache, getTaxRate } from "./tax";

describe("calculateTax", () => {
  it("calculates tax and total for a subtotal", () => {
    expect(calculateTax(100, 20)).toEqual({
      subtotal: 100,
      taxRate: 20,
      taxAmount: 20,
      totalAmount: 120,
    });
  });

  it("defaults tax rate to 20 when not provided", () => {
    expect(calculateTax(50)).toEqual({
      subtotal: 50,
      taxRate: 20,
      taxAmount: 10,
      totalAmount: 60,
    });
  });

  it("rounds monetary values to two decimals", () => {
    expect(calculateTax(99.99, 18)).toEqual({
      subtotal: 99.99,
      taxRate: 18,
      taxAmount: 18,
      totalAmount: 117.99,
    });
  });
});

describe("getTaxRate", () => {
  beforeEach(() => {
    findFirst.mockReset();
    clearTaxRateCache();
  });

  it("reads tax_rate from billing settings", async () => {
    findFirst.mockResolvedValue({ value: "18" });

    await expect(getTaxRate()).resolves.toBe(18);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        group: "billing",
        key: "tax_rate",
      },
      select: { value: true },
    });
  });

  it("defaults to 20 when setting is missing or invalid", async () => {
    findFirst.mockResolvedValue(null);
    await expect(getTaxRate()).resolves.toBe(20);

    clearTaxRateCache();
    findFirst.mockResolvedValue({ value: "invalid" });
    await expect(getTaxRate()).resolves.toBe(20);
  });

  it("caches the tax rate for subsequent calls", async () => {
    findFirst.mockResolvedValue({ value: "10" });

    await expect(getTaxRate()).resolves.toBe(10);
    await expect(getTaxRate()).resolves.toBe(10);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});