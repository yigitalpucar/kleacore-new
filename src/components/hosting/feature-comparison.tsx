import { ComparisonTable, type ComparisonRow } from "@/components/site/comparison-table";
import { Price } from "@/components/site/price";
import type { HostingPlan, PlanFeature } from "./pricing-card";

/**
 * Hosting plan comparison built from DB plan data (`detailedFeatures`),
 * with prices from the DB. Rows are the union of feature labels in
 * the order they first appear. Renders nothing without plans.
 */
export function FeatureComparison({
  plans = [],
  isYearly = false,
}: {
  plans?: HostingPlan[];
  isYearly?: boolean;
}) {
  if (plans.length === 0) return null;

  const labels: string[] = [];
  const icons = new Map<string, PlanFeature>();
  for (const plan of plans) {
    for (const feature of plan.detailedFeatures ?? []) {
      if (!labels.includes(feature.label)) {
        labels.push(feature.label);
        icons.set(feature.label, feature);
      }
    }
  }

  const rows: ComparisonRow[] = labels.map((label) => ({
    label,
    icon: icons.get(label)?.icon,
    values: Object.fromEntries(
      plans.map((plan) => [
        plan.sku,
        plan.detailedFeatures?.find((f) => f.label === label)?.value ?? null,
      ])
    ),
  }));

  return (
    <ComparisonTable
      caption="Hosting paketleri karşılaştırması"
      columns={plans.map((plan) => ({
        key: plan.sku,
        label: plan.name,
        highlight: plan.popular,
        footer: (
          <Price
            amount={isYearly && plan.yearlyPrice ? plan.yearlyPrice : plan.price}
            period="ay"
            size="sm"
          />
        ),
      }))}
      rows={rows}
    />
  );
}
