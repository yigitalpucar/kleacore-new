import type { LucideIcon } from "lucide-react";
import { PlanCard, type PlanCardData, type PlanSpec } from "@/components/site/plan-card";

export interface PlanFeature {
  icon: LucideIcon;
  label: string;
  value: string;
  highlight?: boolean;
}

export interface HostingPlan {
  sku: string;
  slug: string;
  name: string;
  description: string;
  /** VAT-exclusive monthly price. */
  price: number;
  /** VAT-exclusive monthly equivalent on the yearly tier. */
  yearlyPrice?: number;
  period: string;
  features: string[];
  storage: string;
  bandwidth: string;
  websites: string;
  emails: string;
  popular?: boolean;
  cta?: string;
  badge?: string;
  detailedFeatures?: PlanFeature[];
}

interface PricingCardProps {
  plan: HostingPlan;
  isYearly?: boolean;
  className?: string;
}

/** HostingPlan -> kit PlanCardData. */
export function hostingPlanToCard(plan: HostingPlan): PlanCardData {
  const specs: PlanSpec[] = plan.detailedFeatures?.length
    ? plan.detailedFeatures.map((f) => ({
        icon: f.icon,
        label: f.label,
        value: f.value,
        highlight: f.highlight,
      }))
    : [
        { label: "Disk", value: plan.storage },
        { label: "Trafik", value: plan.bandwidth },
        { label: "Web sitesi", value: plan.websites },
        { label: "E-posta", value: plan.emails },
      ].filter((spec) => spec.value);

  return {
    id: plan.sku,
    name: plan.name,
    description: plan.description,
    monthlyPrice: plan.price,
    yearlyMonthlyPrice: plan.yearlyPrice ?? null,
    featured: plan.popular,
    badge: plan.badge,
    specs,
    features: plan.detailedFeatures?.length ? undefined : plan.features,
    cta: { href: `/hosting/satin-al/${plan.slug}`, label: plan.cta },
  };
}

/** Legacy API over the kit's `PlanCard` (featured = DB `isPopular`). */
export function PricingCard({ plan, isYearly = false, className }: PricingCardProps) {
  return (
    <PlanCard
      plan={hostingPlanToCard(plan)}
      billing={isYearly ? "yearly" : "monthly"}
      className={className}
    />
  );
}
