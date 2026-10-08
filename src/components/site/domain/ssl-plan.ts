import type { ProductWithPricing } from "@/lib/products/map-product";

/** Serializable SSL product shape for `SslPlanGrid`. */
export interface SslPlan {
  sku: string;
  name: string;
  description?: string;
  /** VAT-exclusive yearly price (yearly tier, falling back to basePrice). */
  price: number;
  /** No price tiers in the DB: show "Teklif alın" instead of a cart button. */
  quoteOnly: boolean;
  featured: boolean;
  validationType?: string;
  validationTime?: string;
  /** Warranty exactly as stored in the DB (may be in USD). */
  warranty?: string;
  /** Extra limits such as "domains" or "sslCount". */
  domains?: string;
  sslCount?: string;
  features: string[];
}

export function productToSslPlan(product: ProductWithPricing): SslPlan {
  const resources = (product.resourceLimits ?? {}) as Record<string, string>;
  const yearlyTier = product.pricingTiers.find((t) => t.period === "yearly");
  const quoteOnly = product.pricingTiers.length === 0;

  return {
    sku: product.sku,
    name: product.name,
    description: product.shortDescription || undefined,
    price: quoteOnly ? product.basePrice : yearlyTier?.price ?? product.basePrice,
    quoteOnly,
    featured: product.isPopular,
    validationType: resources.validationType || undefined,
    validationTime: resources.validationTime || undefined,
    warranty: resources.warranty || undefined,
    domains: resources.domains || undefined,
    sslCount: resources.sslCount || undefined,
    features: Array.isArray(product.includedFeatures) ? (product.includedFeatures as string[]) : [],
  };
}
