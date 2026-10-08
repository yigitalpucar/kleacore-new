import { describe, expect, it } from "vitest";
import { applyResellerDiscount } from "./index";

describe("applyResellerDiscount", () => {
  it("returns zero for invalid or non-positive base prices", () => {
    expect(applyResellerDiscount(0, 10).toNumber()).toBe(0);
    expect(applyResellerDiscount(-50, 10).toNumber()).toBe(0);
    expect(applyResellerDiscount(Number.NaN, 10).toNumber()).toBe(0);
  });

  it("returns zero for invalid or non-positive discount percentages", () => {
    expect(applyResellerDiscount(100, 0).toNumber()).toBe(0);
    expect(applyResellerDiscount(100, -5).toNumber()).toBe(0);
    expect(applyResellerDiscount(100, Number.NaN).toNumber()).toBe(0);
  });

  it("calculates percentage discounts and rounds to two decimals", () => {
    expect(applyResellerDiscount(100, 10).toNumber()).toBe(10);
    expect(applyResellerDiscount(99.99, 15).toNumber()).toBe(15);
    expect(applyResellerDiscount(33.33, 7.5).toNumber()).toBe(2.5);
    // half-up: 10.05 × 5 % = 0.5025 -> 0.50; 0.15 × 10 % = 0.015 -> 0.02
    expect(applyResellerDiscount("10.05", 5).toFixed(2)).toBe("0.50");
    expect(applyResellerDiscount("0.15", 10).toFixed(2)).toBe("0.02");
  });

  it("caps discount percent at 100", () => {
    expect(applyResellerDiscount(80, 150).toNumber()).toBe(80);
    expect(applyResellerDiscount(50, 100).toNumber()).toBe(50);
  });
});