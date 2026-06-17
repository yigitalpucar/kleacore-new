import { db } from "@/lib/db";
import {
  calculateConfigurationPrice,
  mapConfigOption,
} from "@/lib/products/configurator-pricing";

export type {
  ConfigOptionChoice,
  ConfigOptionPriceLine,
  ConfigOptionType,
  ConfigurationPriceResult,
  ConfigurationSelections,
  ProductConfigOptionView,
} from "@/lib/products/configurator-types";

export { calculateConfigurationPrice };

export async function getProductConfigOptions(productId: string) {
  const options = await db.productConfigOption.findMany({
    where: {
      productId,
      isActive: true,
    },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  return options.map(mapConfigOption);
}

export async function validateConfigurationSelections(
  productId: string,
  selections: import("@/lib/products/configurator-types").ConfigurationSelections
) {
  const options = await getProductConfigOptions(productId);
  const errors: string[] = [];

  for (const option of options) {
    const rawValue = selections[option.slug];
    const hasValue = rawValue !== undefined && rawValue !== null && rawValue !== "";

    if (option.isRequired && !hasValue) {
      errors.push(`${option.name} seçimi zorunludur`);
      continue;
    }

    if (!hasValue) {
      continue;
    }

    if (option.optionType === "select") {
      const value = String(rawValue);
      const choice = option.choices.find((item) => item.value === value);
      if (!choice) {
        errors.push(`${option.name} için geçersiz seçim`);
      }
      continue;
    }

    const quantity = Number(rawValue);
    if (!Number.isInteger(quantity)) {
      errors.push(`${option.name} için geçerli bir sayı girin`);
      continue;
    }

    if (option.minValue !== null && quantity < option.minValue) {
      errors.push(`${option.name} en az ${option.minValue} olmalıdır`);
    }

    if (option.maxValue !== null && quantity > option.maxValue) {
      errors.push(`${option.name} en fazla ${option.maxValue} olabilir`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    options,
  };
}