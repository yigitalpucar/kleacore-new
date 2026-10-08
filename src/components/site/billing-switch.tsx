"use client";

import { useId, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { dativeSuffix, type BillingPeriod } from "@/lib/format/price";

const options: { value: BillingPeriod; label: string }[] = [
  { value: "monthly", label: "Aylık" },
  { value: "yearly", label: "Yıllık" },
];

/**
 * Monthly / yearly segmented control (radiogroup, arrow-key navigable).
 * `savingsPercent` must be computed from real tier prices
 * (see `yearlySavingsPercent` / `maxYearlySavings`) — never hard-code it.
 */
export function BillingSwitch({
  value,
  onChange,
  savingsPercent = 0,
  className,
}: {
  value: BillingPeriod;
  onChange: (value: BillingPeriod) => void;
  savingsPercent?: number;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const pillId = useId();

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const next = (index + 1) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        role="radiogroup"
        aria-label="Faturalandırma dönemi"
        className="relative inline-flex rounded-full border bg-muted/50 p-1"
      >
        {options.map((option, index) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "relative z-10 inline-flex min-h-11 min-w-28 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active ? (
                <motion.span
                  layoutId={`billing-pill-${pillId}`}
                  className="absolute inset-0 -z-10 rounded-full bg-foreground shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              ) : null}
              {option.label}
            </button>
          );
        })}
      </div>
      {savingsPercent > 0 ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Yıllık ödemede %{savingsPercent}&apos;{dativeSuffix(savingsPercent)} varan tasarruf
        </p>
      ) : null}
    </div>
  );
}
