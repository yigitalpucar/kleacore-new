"use client";

import { BillingSwitch } from "@/components/site/billing-switch";
import { useBilling } from "@/components/site/billing-context";
import { buttonClasses } from "@/components/site/button-classes";
import { PackageComparison } from "@/components/site/package-comparison";
import { savingsSummary, type PackageComparisonData } from "@/lib/catalog/package-comparison";
import { useCartPlanAdd } from "./cart-plan-table";
import type { CartTarget } from "./cart-target";

/** Server family package comparison with add-to-cart, on the page's billing period. */
export function ServerPackageComparison({
  data,
  target,
  caption,
}: {
  data: PackageComparisonData;
  target: CartTarget;
  caption: string;
}) {
  const { billing, setBilling } = useBilling();
  const add = useCartPlanAdd(target, billing);
  const savings = savingsSummary(data.columns);
  const hasYearly = data.columns.some((col) => col.yearlyMonthlyPrice !== null);

  return (
    <>
      {hasYearly ? (
        <BillingSwitch
          value={billing}
          onChange={setBilling}
          savingsPercent={savings.max}
          savingsVaries={!savings.uniform}
          className="mb-8 justify-start"
        />
      ) : null}
      <PackageComparison
        data={data}
        billing={billing}
        caption={caption}
        renderAction={(col, size) => (
          <button
            type="button"
            onClick={() =>
              add({ id: col.key, name: col.label, monthlyPrice: col.monthlyPrice, yearlyMonthlyPrice: col.yearlyMonthlyPrice })
            }
            className={buttonClasses({
              variant: col.featured ? "primary" : "outline",
              size: "sm",
              className: size === "sm" ? "min-h-10 w-full px-2" : "min-h-10 w-full",
            })}
            aria-label={`${col.label} paketini satın al`}
          >
            Satın al
          </button>
        )}
      />
      <p className="mt-4 text-xs text-muted-foreground">
        {billing === "yearly" ? "Yıllık ödemede aylık karşılığı ve yıllık toplam gösterilir. " : ""}
        Fiyatlara KDV dahil değildir; %20 KDV ödeme adımında eklenir.
      </p>
    </>
  );
}
