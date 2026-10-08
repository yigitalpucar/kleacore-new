import type { ComparisonRow } from "@/components/site/comparison-table";
import type { PlanCardData } from "@/components/site/plan-card";
import { productToPlanCard, type ProductWithPricing } from "@/lib/products/map-product";

/** Serializable comparison column (prices are added on the client per billing period). */
export interface HostingComparisonColumn {
  key: string;
  label: string;
  highlight?: boolean;
}

export interface HostingComparisonData {
  columns: HostingComparisonColumn[];
  rows: ComparisonRow[];
}

/** Numeric resources parsed from `resourceLimits` (for the resource bars). */
export interface HostingResourceRow {
  id: string;
  name: string;
  featured: boolean;
  cpu: number | null;
  ram: number | null;
  disk: number | null;
}

interface FeatureItem {
  label: string;
  value: string;
  icon?: string;
}

const CHECK_VALUES = new Set(["✓", "✔", "var", "evet"]);

/**
 * Builds a plan-by-plan comparison from the products' DB `features`.
 * Rows keep the order in which labels first appear; "✓" becomes a check icon.
 */
export function buildHostingComparison(products: ProductWithPricing[]): HostingComparisonData {
  const columns = products.map((product) => ({
    key: product.sku,
    label: product.name,
    highlight: product.isPopular,
  }));

  const order: { label: string; icon?: string }[] = [];
  const byProduct = new Map<string, Map<string, string>>();

  for (const product of products) {
    const features = (product.features as unknown as FeatureItem[] | null) ?? [];
    const values = new Map<string, string>();
    for (const feature of features) {
      if (!order.some((row) => row.label === feature.label)) {
        order.push({ label: feature.label, icon: feature.icon });
      }
      values.set(feature.label, feature.value);
    }
    byProduct.set(product.sku, values);
  }

  const rows: ComparisonRow[] = order.map((row) => ({
    label: row.label,
    icon: row.icon,
    values: Object.fromEntries(
      products.map((product) => {
        const raw = byProduct.get(product.sku)?.get(row.label);
        if (raw === undefined) return [product.sku, null];
        return [product.sku, CHECK_VALUES.has(raw.trim().toLowerCase()) ? true : raw];
      })
    ),
  }));

  return { columns, rows };
}

function firstNumber(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.replace(",", ".").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/** CPU (core), RAM (GB) and disk (GB) per plan, parsed from DB `resourceLimits`. */
export function buildResourceRows(products: ProductWithPricing[]): HostingResourceRow[] {
  return products.map((product) => {
    const res = (product.resourceLimits as Record<string, unknown> | null) ?? {};
    return {
      id: product.sku,
      name: product.name,
      featured: product.isPopular,
      cpu: firstNumber(res.cpu),
      ram: firstNumber(res.ram),
      disk: firstNumber(res.storage ?? res.disk),
    };
  });
}

/** Everything a hosting landing page needs from its products (serializable). */
export function buildHostingPageData(products: ProductWithPricing[]) {
  const plans: PlanCardData[] = products.map((product) => productToPlanCard(product));
  return {
    plans,
    comparison: buildHostingComparison(products),
    resources: buildResourceRows(products),
  };
}

export type HostingSubType = "linux" | "wordpress" | "kurumsal" | "reseller";

/** Lowest monthly price per hosting sub type (for the cross-links). */
export function startingPricesBySubType(
  products: ProductWithPricing[]
): Partial<Record<HostingSubType, number>> {
  const result: Partial<Record<HostingSubType, number>> = {};
  for (const product of products) {
    const sub = product.subType as HostingSubType;
    const card = productToPlanCard(product);
    const price = card.monthlyPrice;
    if (!price || price <= 0) continue;
    if (result[sub] === undefined || price < (result[sub] as number)) result[sub] = price;
  }
  return result;
}
