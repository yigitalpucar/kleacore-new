import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    productConfigOption: {
      findMany,
    },
  },
}));

import {
  calculateConfigurationPrice,
  getProductConfigOptions,
  validateConfigurationSelections,
  type ProductConfigOptionView,
} from "./configurator";

const sampleOptions: ProductConfigOptionView[] = [
  {
    id: "opt-1",
    productId: "prod-1",
    name: "PHP Sürümü",
    slug: "php-version",
    optionType: "select",
    choices: [
      { value: "8.1", label: "PHP 8.1", priceMonthly: 0, priceYearly: 0 },
      { value: "8.3", label: "PHP 8.3", priceMonthly: 10, priceYearly: 100 },
    ],
    minValue: null,
    maxValue: null,
    unitPrice: 0,
    unitPriceYearly: 0,
    isRequired: true,
    displayOrder: 1,
    isActive: true,
  },
  {
    id: "opt-2",
    productId: "prod-1",
    name: "Ek E-posta",
    slug: "extra-email",
    optionType: "quantity",
    choices: [],
    minValue: 0,
    maxValue: 20,
    unitPrice: 5,
    unitPriceYearly: 50,
    isRequired: false,
    displayOrder: 2,
    isActive: true,
  },
];

describe("calculateConfigurationPrice", () => {
  it("calculates select and quantity option prices for monthly billing", () => {
    const result = calculateConfigurationPrice(
      sampleOptions,
      {
        "php-version": "8.3",
        "extra-email": 3,
      },
      "monthly"
    );

    expect(result).toEqual({
      total: 25,
      lines: [
        {
          slug: "php-version",
          name: "PHP Sürümü",
          optionType: "select",
          value: "8.3",
          label: "PHP 8.3",
          price: 10,
        },
        {
          slug: "extra-email",
          name: "Ek E-posta",
          optionType: "quantity",
          value: 3,
          label: "3 adet",
          price: 15,
        },
      ],
    });
  });

  it("uses yearly prices when billing period is yearly", () => {
    const result = calculateConfigurationPrice(
      sampleOptions,
      {
        "php-version": "8.3",
        "extra-email": 2,
      },
      "yearly"
    );

    expect(result.total).toBe(200);
    expect(result.lines[0]?.price).toBe(100);
    expect(result.lines[1]?.price).toBe(100);
  });

  it("ignores empty or invalid selections", () => {
    const result = calculateConfigurationPrice(
      sampleOptions,
      {
        "php-version": "",
        "extra-email": 0,
      },
      "monthly"
    );

    expect(result).toEqual({ total: 0, lines: [] });
  });
});

describe("getProductConfigOptions", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("loads and maps active product config options", async () => {
    findMany.mockResolvedValue([
      {
        id: "opt-1",
        productId: "prod-1",
        name: "PHP Sürümü",
        slug: "php-version",
        optionType: "select",
        choices: [{ value: "8.3", label: "PHP 8.3", priceMonthly: 10, priceYearly: 100 }],
        minValue: null,
        maxValue: null,
        unitPrice: 0,
        unitPriceYearly: 0,
        isRequired: true,
        displayOrder: 1,
        isActive: true,
      },
    ]);

    const options = await getProductConfigOptions("prod-1");

    expect(findMany).toHaveBeenCalledWith({
      where: { productId: "prod-1", isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    expect(options).toHaveLength(1);
    expect(options[0]?.slug).toBe("php-version");
    expect(options[0]?.choices[0]?.priceMonthly).toBe(10);
  });
});

describe("validateConfigurationSelections", () => {
  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue(
      sampleOptions.map((option) => ({
        ...option,
        choices: option.choices,
      }))
    );
  });

  it("returns valid for correct selections", async () => {
    const result = await validateConfigurationSelections("prod-1", {
      "php-version": "8.1",
      "extra-email": 5,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("reports missing required options and invalid values", async () => {
    const result = await validateConfigurationSelections("prod-1", {
      "php-version": "9.0",
      "extra-email": 25,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("PHP Sürümü için geçersiz seçim");
    expect(result.errors).toContain("Ek E-posta en fazla 20 olabilir");
  });

  it("reports missing required select options", async () => {
    const result = await validateConfigurationSelections("prod-1", {});

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("PHP Sürümü seçimi zorunludur");
  });
});