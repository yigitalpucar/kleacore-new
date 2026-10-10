"use client";

import { useId } from "react";
import { formatTRY } from "@/lib/format/price";
import { monthlyEquivalent } from "@/lib/billing/period-price";
import { cn } from "@/lib/utils";

export interface PeriodChoice {
  period: "monthly" | "yearly";
  /** Pre-tax charge for one period (12-month total for yearly). */
  unitPrice: number;
}

/**
 * Aylık / Yıllık switch of a cart line, priced by the server quote. Yearly
 * shows its monthly equivalent so the two are comparable.
 */
export function PeriodSwitch({
  itemTitle,
  value,
  choices,
  onChange,
  disabled,
}: {
  itemTitle: string;
  value: "monthly" | "yearly";
  choices: PeriodChoice[];
  onChange: (choice: PeriodChoice) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="sr-only">{itemTitle} için faturalama dönemi</legend>
      <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
        {choices.map((choice) => {
          const checked = choice.period === value;
          const amount =
            choice.period === "yearly" ? monthlyEquivalent(choice.unitPrice, "yearly") : choice.unitPrice;
          return (
            <label
              key={choice.period}
              className={cn(
                "relative flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                checked ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <input
                type="radio"
                name={name}
                value={choice.period}
                checked={checked}
                onChange={() => onChange(choice)}
                className="sr-only"
              />
              {choice.period === "yearly" ? "Yıllık" : "Aylık"}
              <span className="tabular-nums text-muted-foreground">
                {formatTRY(amount, { keepDecimals: !Number.isInteger(amount) })}/ay
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
