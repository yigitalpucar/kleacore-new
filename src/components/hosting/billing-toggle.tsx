"use client";

import { BillingSwitch } from "@/components/site/billing-switch";

interface BillingToggleProps {
  isYearly: boolean;
  onToggle: (isYearly: boolean) => void;
  /**
   * Real saving from tier prices (`maxYearlySavings(plans)` in
   * src/lib/format/price.ts). Omit to hide the savings note.
   */
  savingsPercent?: number;
  className?: string;
}

/** Legacy boolean API over the kit's `BillingSwitch`. */
export function BillingToggle({ isYearly, onToggle, savingsPercent, className }: BillingToggleProps) {
  return (
    <BillingSwitch
      value={isYearly ? "yearly" : "monthly"}
      onChange={(value) => onToggle(value === "yearly")}
      savingsPercent={savingsPercent}
      className={className}
    />
  );
}
