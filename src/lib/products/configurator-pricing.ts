import type { BillingPeriod } from "@prisma/client";
import type {
  ConfigOptionChoice,
  ConfigOptionPriceLine,
  ConfigOptionType,
  ConfigurationPriceResult,
  ConfigurationSelections,
  ProductConfigOptionView,
} from "./configurator-types";
import { mul, sum, toNumber, type MoneyInput } from "@/lib/money";

export type {
  ConfigOptionChoice,
  ConfigOptionPriceLine,
  ConfigOptionType,
  ConfigurationPriceResult,
  ConfigurationSelections,
  ProductConfigOptionView,
};

export function parseChoices(value: unknown): ConfigOptionChoice[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const choiceValue = record.value;
      const choiceLabel = record.label;

      if (typeof choiceValue !== "string" || typeof choiceLabel !== "string") {
        return null;
      }

      return {
        value: choiceValue,
        label: choiceLabel,
        priceMonthly: toNumber(record.priceMonthly as MoneyInput),
        priceYearly: toNumber(record.priceYearly as MoneyInput),
      };
    })
    .filter((choice): choice is ConfigOptionChoice => choice !== null);
}

export function normalizeOptionType(value: string): ConfigOptionType {
  return value === "quantity" ? "quantity" : "select";
}

export function mapConfigOption(option: {
  id: string;
  productId: string;
  name: string;
  slug: string;
  optionType: string;
  choices: unknown;
  minValue: number | null;
  maxValue: number | null;
  unitPrice: MoneyInput;
  unitPriceYearly: MoneyInput;
  isRequired: boolean;
  displayOrder: number;
  isActive: boolean;
}): ProductConfigOptionView {
  return {
    id: option.id,
    productId: option.productId,
    name: option.name,
    slug: option.slug,
    optionType: normalizeOptionType(option.optionType),
    choices: parseChoices(option.choices),
    minValue: option.minValue,
    maxValue: option.maxValue,
    unitPrice: toNumber(option.unitPrice),
    unitPriceYearly: toNumber(option.unitPriceYearly),
    isRequired: option.isRequired,
    displayOrder: option.displayOrder,
    isActive: option.isActive,
  };
}

export function calculateConfigurationPrice(
  options: ProductConfigOptionView[],
  selections: ConfigurationSelections,
  billingPeriod: BillingPeriod
): ConfigurationPriceResult {
  const lines: ConfigOptionPriceLine[] = [];

  for (const option of options) {
    const rawValue = selections[option.slug];
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      continue;
    }

    if (option.optionType === "select") {
      const value = String(rawValue);
      const choice = option.choices.find((item) => item.value === value);
      if (!choice) {
        continue;
      }

      const price = billingPeriod === "yearly" ? choice.priceYearly : choice.priceMonthly;
      lines.push({
        slug: option.slug,
        name: option.name,
        optionType: option.optionType,
        value,
        label: choice.label,
        price: toNumber(price),
      });
      continue;
    }

    const quantity = Number(rawValue);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    const unitPrice = billingPeriod === "yearly" ? option.unitPriceYearly : option.unitPrice;
    lines.push({
      slug: option.slug,
      name: option.name,
      optionType: option.optionType,
      value: quantity,
      label: `${quantity} adet`,
      price: toNumber(mul(unitPrice, quantity)),
    });
  }

  const total = toNumber(sum(lines.map((line) => line.price)));

  return { total, lines };
}