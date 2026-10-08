import { describe, expect, it } from "vitest";
import { dativeSuffix, formatTRY, periodLabel, yearlySavingsPercent } from "./price";

const nbsp = " ";

describe("formatTRY", () => {
  it("formats decimals with a comma", () => {
    expect(formatTRY(99.99)).toBe(`99,99${nbsp}₺`);
  });

  it("drops ,00 for whole numbers", () => {
    expect(formatTRY(49)).toBe(`49${nbsp}₺`);
  });

  it("uses dot thousands separators", () => {
    expect(formatTRY(1299)).toBe(`1.299${nbsp}₺`);
    expect(formatTRY(2099.17)).toBe(`2.099,17${nbsp}₺`);
  });

  it("can keep decimals and omit the symbol", () => {
    expect(formatTRY(49, { keepDecimals: true })).toBe(`49,00${nbsp}₺`);
    expect(formatTRY(83.99, { symbol: false })).toBe("83,99");
  });

  it("rounds float noise to kuruş", () => {
    expect(formatTRY(83.99000000001)).toBe(`83,99${nbsp}₺`);
  });
});

describe("periodLabel", () => {
  it("maps periods to Turkish short labels", () => {
    expect(periodLabel("monthly")).toBe("ay");
    expect(periodLabel("yearly")).toBe("yıl");
  });
});

describe("yearlySavingsPercent", () => {
  it("computes the floored saving", () => {
    expect(yearlySavingsPercent(49, 39)).toBe(20);
    expect(yearlySavingsPercent(99.99, 83.99)).toBe(16);
  });

  it("returns 0 when there is no saving", () => {
    expect(yearlySavingsPercent(49, undefined)).toBe(0);
    expect(yearlySavingsPercent(49, 49)).toBe(0);
  });
});

describe("dativeSuffix", () => {
  it("follows Turkish vowel harmony of the spoken number", () => {
    expect(dativeSuffix(20)).toBe("ye");
    expect(dativeSuffix(16)).toBe("ya");
    expect(dativeSuffix(15)).toBe("e");
    expect(dativeSuffix(10)).toBe("a");
    expect(dativeSuffix(19)).toBe("a");
    expect(dativeSuffix(100)).toBe("e");
  });
});
