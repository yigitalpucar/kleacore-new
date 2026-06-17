import { describe, expect, it } from "vitest";
import { applyResellerDiscount } from "./index";

describe("applyResellerDiscount", () => {
  it("returns zero for invalid or non-positive base prices", () => {
    expect(applyResellerDiscount(0, 10)).toBe(0);
    expect(applyResellerDiscount(-50, 10)).toBe(0);
    expect(applyResellerDiscount(Number.NaN, 10)).toBe(0);
  });

  it("returns zero for invalid or non-positive discount percentages", () => {
    expect(applyResellerDiscount(100, 0)).toBe(0);
    expect(applyResellerDiscount(100, -5)).toBe(0);
    expect(applyResellerDiscount(100, Number.NaN)).toBe(0);
  });

  it("calculates percentage discounts and rounds to two decimals", () => {
    expect(applyResellerDiscount(100, 10)).toBe(10);
    expect(applyResellerDiscount(99.99, 15)).toBe(15);
    expect(applyResellerDiscount(33.33, 7.5)).toBe(2.5);
  });

  it("caps discount percent at 100", () => {
    expect(applyResellerDiscount(80, 150)).toBe(80);
    expect(applyResellerDiscount(50, 100)).toBe(50);
  });
});