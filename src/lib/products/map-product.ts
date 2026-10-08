import type { PricingTier, Product, ProductCategory } from "@prisma/client";
import type { HostingPlan } from "@/components/hosting/pricing-card";
import type { PlanCardData } from "@/components/site/plan-card";
import type { ServerPlanRow } from "@/components/site/server-plan-table";
import { getIcon } from "@/lib/utils/icon-map";

export type ProductWithPricing = Product & {
  category: ProductCategory;
  pricingTiers: PricingTier[];
};

interface FeatureItem {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}

export function mapProductToHostingPlan(product: ProductWithPricing): HostingPlan {
  const monthlyTier = product.pricingTiers.find((t) => t.period === "monthly");
  const yearlyTier = product.pricingTiers.find((t) => t.period === "yearly");
  const resources = product.resourceLimits as Record<string, string>;
  const features = product.features as unknown as FeatureItem[];

  return {
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    description: product.shortDescription,
    price: monthlyTier?.price ?? product.basePrice,
    yearlyPrice: yearlyTier?.discountedPrice ?? yearlyTier?.price,
    period: "ay",
    features: (product.includedFeatures as string[]) ?? [],
    storage: resources?.storage ?? "",
    bandwidth: resources?.bandwidth ?? "",
    websites: resources?.websites ?? "",
    emails: resources?.emails ?? "",
    popular: product.isPopular,
    badge: product.badge ?? undefined,
    detailedFeatures: features?.map((f) => ({
      icon: getIcon(f.icon),
      label: f.label,
      value: f.value,
      highlight: f.highlight,
    })),
  };
}

export interface ServerPlanView {
  sku: string;
  slug: string;
  name: string;
  cpu: string;
  ram: string;
  disk: string;
  traffic: string;
  port: string;
  monthlyPrice: number;
  discountedMonthly: number;
  /** Yearly total (monthly equivalent on the yearly tier x 12). */
  yearlyPrice: number;
  /** Monthly equivalent when billed yearly (the yearly tier price). */
  yearlyMonthly: number;
  popular: boolean;
}

export function mapProductToServerPlan(product: ProductWithPricing): ServerPlanView {
  const res = product.resourceLimits as unknown as Record<string, string>;
  const monthly = product.pricingTiers.find((t) => t.period === "monthly");
  const yearly = product.pricingTiers.find((t) => t.period === "yearly");

  return {
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    cpu: res?.cpu ?? "",
    ram: res?.ram ?? "",
    disk: res?.disk ?? "",
    traffic: res?.traffic ?? "",
    port: res?.port ?? "",
    monthlyPrice: monthly?.renewalPrice ?? monthly?.price ?? product.basePrice,
    discountedMonthly: monthly?.discountedPrice ?? monthly?.price ?? product.basePrice,
    // Yearly tier prices are stored as the monthly equivalent (e.g. 83,99/ay).
    yearlyPrice: (yearly?.discountedPrice ?? yearly?.price ?? monthly?.price ?? product.basePrice) * 12,
    yearlyMonthly: yearly?.discountedPrice ?? yearly?.price ?? monthly?.price ?? product.basePrice,
    popular: product.isPopular,
  };
}

/* ------------------------------------------------------------------
 * Site kit adapters (serializable — safe to pass from server pages to
 * client components such as PlanGrid). Prices are VAT-exclusive.
 * ---------------------------------------------------------------- */

function tierPrices(product: ProductWithPricing) {
  const monthly = product.pricingTiers.find((t) => t.period === "monthly");
  const yearly = product.pricingTiers.find((t) => t.period === "yearly");
  const monthlyPrice = monthly?.discountedPrice ?? monthly?.price ?? product.basePrice;
  const yearlyMonthlyPrice = yearly ? (yearly.discountedPrice ?? yearly.price) : null;
  return { monthlyPrice, yearlyMonthlyPrice };
}

/** DB product -> PlanCardData (hosting-style card). */
export function productToPlanCard(
  product: ProductWithPricing,
  options: { href?: string; ctaLabel?: string; maxSpecs?: number } = {}
): PlanCardData {
  const features = (product.features as unknown as FeatureItem[] | null) ?? [];
  const { monthlyPrice, yearlyMonthlyPrice } = tierPrices(product);
  return {
    id: product.sku,
    name: product.name,
    description: product.shortDescription || undefined,
    monthlyPrice,
    yearlyMonthlyPrice,
    featured: product.isPopular,
    badge: product.badge ?? undefined,
    specs: features.slice(0, options.maxSpecs ?? features.length).map((f) => ({
      label: f.label,
      value: f.value,
      icon: f.icon,
      highlight: f.highlight,
    })),
    cta: {
      href: options.href ?? `/hosting/satin-al/${product.slug}`,
      label: options.ctaLabel,
    },
  };
}

/** DB server product (VDS/VPS/…) -> ServerPlanRow for ServerPlanTable. */
export function productToServerRow(
  product: ProductWithPricing,
  options: { href: string; ctaLabel?: string }
): ServerPlanRow {
  const res = (product.resourceLimits as unknown as Record<string, string> | null) ?? {};
  const { monthlyPrice, yearlyMonthlyPrice } = tierPrices(product);
  return {
    id: product.sku,
    name: product.name,
    featured: product.isPopular,
    specs: {
      cpu: res.cpu ?? "",
      ram: res.ram ?? "",
      disk: res.disk ?? "",
      traffic: res.traffic ?? res.bandwidth ?? "",
      port: res.port ?? "",
    },
    monthlyPrice,
    yearlyMonthlyPrice,
    href: options.href,
    ctaLabel: options.ctaLabel,
  };
}