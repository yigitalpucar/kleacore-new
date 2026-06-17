import type { BillingPeriod } from "@prisma/client";
import type {
  ConfigOptionChoice,
  ConfigOptionPriceLine,
  ConfigOptionType,
  ConfigurationPriceResult,
  ConfigurationSelections,
  ProductConfigOptionView,
} from "./configurator-types";

export type {
  ConfigOptionChoice,
  ConfigOptionPriceLine,
  ConfigOptionType,
  ConfigurationPriceResult,
  ConfigurationSelections,
  ProductConfigOptionView,
};

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

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
        priceMonthly: Number(record.priceMonthly ?? 0),
        priceYearly: Number(record.priceYearly ?? 0),
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
  unitPrice: number;
  unitPriceYearly: number;
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
    unitPrice: Number(option.unitPrice),
    unitPriceYearly: Number(option.unitPriceYearly),
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
        price: roundMoney(price),
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
      price: roundMoney(unitPrice * quantity),
    });
  }

  const total = roundMoney(lines.reduce((sum, line) => sum + line.price, 0));

  return { total, lines };
}