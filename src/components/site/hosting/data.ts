import { buildPackageComparison, type PackageComparisonData } from "@/lib/catalog/package-comparison";
import type { PlanCardData } from "@/components/site/plan-card";
import { productToPlanCard, type ProductWithPricing } from "@/lib/products/map-product";

/** Plan-by-plan comparison of a hosting family (prices picked per billing period on the client). */
export type HostingComparisonData = PackageComparisonData;

/** Numeric resources parsed from `resourceLimits` (for the resource bars). */
export interface HostingResourceRow {
  id: string;
  name: string;
  featured: boolean;
  cpu: number | null;
  ram: number | null;
  disk: number | null;
}

/**
 * Builds a plan-by-plan comparison from the products' DB `features` and
 * `includedFeatures` (see src/lib/catalog/package-comparison.ts).
 */
export function buildHostingComparison(products: ProductWithPricing[]): HostingComparisonData {
  return buildPackageComparison(products);
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
