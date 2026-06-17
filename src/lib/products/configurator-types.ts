export type ConfigOptionType = "select" | "quantity";

export interface ConfigOptionChoice {
  value: string;
  label: string;
  priceMonthly: number;
  priceYearly: number;
}

export interface ProductConfigOptionView {
  id: string;
  productId: string;
  name: string;
  slug: string;
  optionType: ConfigOptionType;
  choices: ConfigOptionChoice[];
  minValue: number | null;
  maxValue: number | null;
  unitPrice: number;
  unitPriceYearly: number;
  isRequired: boolean;
  displayOrder: number;
  isActive: boolean;
}

export type ConfigurationSelections = Record<string, string | number>;

export interface ConfigOptionPriceLine {
  slug: string;
  name: string;
  optionType: ConfigOptionType;
  value: string | number;
  label: string;
  price: number;
}

export interface ConfigurationPriceResult {
  total: number;
  lines: ConfigOptionPriceLine[];
}