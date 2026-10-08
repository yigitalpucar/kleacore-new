import { cn } from "@/lib/utils";
import { formatTRY, periodLabel, type BillingPeriod } from "@/lib/format/price";

type PriceSize = "sm" | "md" | "lg" | "xl";

const amountSizes: Record<PriceSize, string> = {
  sm: "text-base",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-5xl",
};

export interface PriceProps {
  /** VAT-exclusive TRY amount from the DB. Never hard-code prices. */
  amount: number;
  /** Billing period suffix ("/ay", "/yıl"). Omit for one-off prices. */
  period?: BillingPeriod | "ay" | "yıl";
  size?: PriceSize;
  /** Show the small "+KDV" note (default true). */
  vatNote?: boolean;
  /** Prefix such as "başlayan" rendered after the amount ("49 ₺/ay'dan"). */
  from?: boolean;
  className?: string;
}

/**
 * Renders a VAT-exclusive price: `49 ₺ /ay +KDV`.
 * Screen readers get "49 ₺ aylık, KDV hariç".
 */
export function Price({
  amount,
  period,
  size = "lg",
  vatNote = true,
  from = false,
  className,
}: PriceProps) {
  const label = period ? periodLabel(period) : null;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-1", className)}>
      <span
        className={cn(
          "font-semibold tabular-nums tracking-tight text-current",
          amountSizes[size]
        )}
      >
        {formatTRY(amount)}
      </span>
      {label ? (
        <span className="text-sm text-muted-foreground">
          <span aria-hidden>/</span>
          {label}
          {from ? "'dan" : null}
          <span className="sr-only">{label === "ay" ? " aylık" : " yıllık"}</span>
        </span>
      ) : from ? (
        <span className="text-sm text-muted-foreground">başlayan</span>
      ) : null}
      {vatNote ? (
        <span className="rounded border border-border px-1 py-px font-mono text-[10px] font-medium uppercase leading-none tracking-wide text-muted-foreground">
          <span aria-hidden>+KDV</span>
          <span className="sr-only">, KDV hariç</span>
        </span>
      ) : null}
    </span>
  );
}
