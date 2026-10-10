/**
 * Side-by-side package comparison built only from DB product records:
 * rows come from `features` (label/value) and `includedFeatures` (check
 * marks), prices from the pricing tiers, the highlight from `isPopular`.
 *
 * Pure and serializable: built on the server, rendered by the client
 * `PackageComparison` component, which picks the price per billing period.
 */
import type { ComparisonRow, ComparisonValue } from "@/components/site/comparison-table";
import { yearlySavingsPercent } from "@/lib/format/price";
import { toNumber, type MoneyInput } from "@/lib/money";

/** Label of the package flagged `isPopular` in the DB (the only source of it). */
export const FEATURED_LABEL = "En çok tercih edilen";

/** Uptime / SLA percentages are not shown on the site (no verifiable SLA). */
export const isUnverifiedClaim = (text: string) => /uptime|\bsla\b|%\s?99/i.test(text);

interface TierLike {
  period: string;
  price: MoneyInput;
  discountedPrice?: MoneyInput | null;
  isActive?: boolean;
}

/** The subset of a product record the comparison needs. */
export interface ComparableProduct {
  sku: string;
  slug: string;
  name: string;
  isPopular: boolean;
  basePrice: MoneyInput;
  features: unknown;
  includedFeatures: unknown;
  pricingTiers: TierLike[];
}

export interface PackageColumn {
  key: string;
  slug: string;
  label: string;
  /** DB `isPopular` — the only source of the "En çok tercih edilen" mark. */
  featured: boolean;
  /** VAT-exclusive monthly price (what checkout charges for a month). */
  monthlyPrice: number;
  /** Monthly equivalent on the yearly tier, null when there is no yearly tier. */
  yearlyMonthlyPrice: number | null;
  /** Floored % saved by paying yearly; 0 when yearly is not cheaper. */
  savingsPercent: number;
}

export interface PackageRow extends ComparisonRow {
  group: "features" | "included";
}

export interface PackageComparisonData {
  columns: PackageColumn[];
  rows: PackageRow[];
}

interface FeatureItem {
  label?: unknown;
  value?: unknown;
  icon?: unknown;
}

const CHECK_VALUES = new Set(["✓", "✔", "var", "evet"]);

/**
 * Price the checkout charges for a tier (discountedPrice wins, inactive tiers
 * are ignored — same rule as getCatalogProduct in checkout.ts).
 */
function tierAmount(product: ComparableProduct, period: "monthly" | "yearly"): number | null {
  const tier = product.pricingTiers.find((t) => t.period === period && t.isActive !== false);
  if (!tier) return null;
  return toNumber(tier.discountedPrice ?? tier.price);
}

export function packagePrices(product: ComparableProduct) {
  const monthlyPrice = tierAmount(product, "monthly") ?? toNumber(product.basePrice);
  const yearlyMonthlyPrice = tierAmount(product, "yearly");
  return {
    monthlyPrice,
    yearlyMonthlyPrice,
    savingsPercent: yearlySavingsPercent(monthlyPrice, yearlyMonthlyPrice),
  };
}

function featureList(product: ComparableProduct): { label: string; value: string; icon?: string }[] {
  if (!Array.isArray(product.features)) return [];
  return (product.features as FeatureItem[])
    .filter((f) => typeof f?.label === "string" && typeof f?.value === "string")
    .map((f) => ({
      label: (f.label as string).trim(),
      value: (f.value as string).trim(),
      icon: typeof f.icon === "string" ? f.icon : undefined,
    }));
}

function includedList(product: ComparableProduct): string[] {
  if (!Array.isArray(product.includedFeatures)) return [];
  return (product.includedFeatures as unknown[])
    .filter((item): item is string => typeof item === "string" && item.trim() !== "")
    .map((item) => item.trim())
    .filter((item) => !isUnverifiedClaim(item));
}

export function buildPackageComparison(products: ComparableProduct[]): PackageComparisonData {
  const columns: PackageColumn[] = products.map((product) => ({
    key: product.sku,
    slug: product.slug,
    label: product.name,
    featured: product.isPopular,
    ...packagePrices(product),
  }));

  // Feature rows keep the order in which labels first appear.
  const order: { label: string; icon?: string }[] = [];
  const values = new Map<string, Map<string, string>>();
  for (const product of products) {
    const byLabel = new Map<string, string>();
    for (const feature of featureList(product)) {
      if (!order.some((row) => row.label === feature.label)) order.push({ label: feature.label, icon: feature.icon });
      byLabel.set(feature.label, feature.value);
    }
    values.set(product.sku, byLabel);
  }

  const featureRows: PackageRow[] = order.map((row) => ({
    group: "features",
    label: row.label,
    icon: row.icon,
    values: Object.fromEntries(
      products.map((product): [string, ComparisonValue] => {
        const raw = values.get(product.sku)?.get(row.label);
        if (raw === undefined || raw === "") return [product.sku, null];
        return [product.sku, CHECK_VALUES.has(raw.toLocaleLowerCase("tr")) ? true : raw];
      })
    ),
  }));

  // Included services: one check row per item, in first-seen order.
  const includedOrder: string[] = [];
  const includedBy = new Map<string, Set<string>>();
  for (const product of products) {
    const items = includedList(product);
    includedBy.set(product.sku, new Set(items));
    for (const item of items) if (!includedOrder.includes(item)) includedOrder.push(item);
  }
  const includedRows: PackageRow[] = includedOrder.map((item) => ({
    group: "included",
    label: item,
    values: Object.fromEntries(products.map((p) => [p.sku, includedBy.get(p.sku)?.has(item) ?? false])),
  }));

  return { columns, rows: [...featureRows, ...includedRows] };
}

/**
 * Yearly saving across a set of packages for the billing switch badge.
 * `max` 0 means no package is cheaper yearly (badge hidden); `uniform` is
 * true when every package that has a saving saves the same percentage.
 */
export function savingsSummary(columns: Array<Pick<PackageColumn, "savingsPercent">>) {
  const values = columns.map((c) => c.savingsPercent).filter((v) => v > 0);
  if (values.length === 0) return { max: 0, uniform: true };
  const max = Math.max(...values);
  return { max, uniform: values.length === columns.length && values.every((v) => v === max) };
}
