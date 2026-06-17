import type { PricingTier, Product, ProductCategory } from "@prisma/client";
import type { HostingPlan } from "@/components/hosting/pricing-card";
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
  yearlyPrice: number;
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
    yearlyPrice: yearly?.price ?? (monthly?.price ?? product.basePrice) * 12,
    popular: product.isPopular,
  };
}