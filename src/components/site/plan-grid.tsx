"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { maxYearlySavings, type BillingPeriod } from "@/lib/format/price";
import { BillingSwitch } from "./billing-switch";
import { PlanCard, type PlanCardData } from "./plan-card";

export interface PlanGridProps {
  plans: PlanCardData[];
  /** Uncontrolled initial period (default "monthly"). */
  defaultBilling?: BillingPeriod;
  /** Controlled period — pass together with onBillingChange. */
  billing?: BillingPeriod;
  onBillingChange?: (value: BillingPeriod) => void;
  /** Render the monthly/yearly switch above the grid (default true). */
  showSwitch?: boolean;
  emptyMessage?: string;
  className?: string;
}

/**
 * Responsive grid of PlanCards with a monthly/yearly switch.
 * 1 col (phone) → 2 (sm) → up to 4 (lg) depending on plan count.
 */
export function PlanGrid({
  plans,
  defaultBilling = "monthly",
  billing: controlled,
  onBillingChange,
  showSwitch = true,
  emptyMessage = "Bu kategoride şu anda satışta paket bulunmuyor.",
  className,
}: PlanGridProps) {
  const [internal, setInternal] = useState<BillingPeriod>(defaultBilling);
  const billing = controlled ?? internal;
  const setBilling = (value: BillingPeriod) => {
    if (!controlled) setInternal(value);
    onBillingChange?.(value);
  };

  if (plans.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const hasYearly = plans.some((plan) => plan.yearlyMonthlyPrice);
  const lgCols =
    plans.length >= 4 ? "lg:grid-cols-4" : plans.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";

  return (
    <div className={className}>
      {showSwitch && hasYearly ? (
        <BillingSwitch
          value={billing}
          onChange={setBilling}
          savingsPercent={maxYearlySavings(plans)}
          className="mb-10"
        />
      ) : null}
      <div
        className={cn(
          "mx-auto grid gap-4 sm:grid-cols-2",
          lgCols,
          plans.length <= 2 && "max-w-4xl",
          plans.length === 3 && "max-w-6xl"
        )}
      >
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} billing={billing} />
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Fiyatlara KDV dahil değildir. %20 KDV ödeme adımında eklenir.
      </p>
    </div>
  );
}
