import { formatTRY } from "@/lib/format/price";
import { monthlyEquivalent, type PriceBasis } from "@/lib/billing/period-price";
import { cn } from "@/lib/utils";

/**
 * One-line billing explanation under a cart / summary amount.
 *
 *   yearly hosting/server → "aylık 39 ₺ karşılığı · yıllık toplam 468 ₺ +KDV"
 *   monthly               → "aylık 49 ₺ +KDV"
 *   domain / SSL (yearly) → "1 yıllık ücret +KDV" (price already is the yearly total)
 *
 * `total` is the pre-tax charge for one billing period.
 */
export function periodNoteText(
  total: number,
  period: "monthly" | "yearly" | undefined,
  basis: PriceBasis
): string {
  const money = (n: number) => formatTRY(n, { keepDecimals: !Number.isInteger(n) });
  if (period === "yearly" && basis === "monthly-equivalent") {
    return `aylık ${money(monthlyEquivalent(total, "yearly"))} karşılığı · yıllık toplam ${money(total)} +KDV`;
  }
  if (period === "yearly") {
    return "1 yıllık ücret +KDV";
  }
  return `aylık ${money(total)} +KDV`;
}

export function PeriodNote({
  total,
  period,
  basis,
  className,
}: {
  total: number;
  period: "monthly" | "yearly" | undefined;
  basis: PriceBasis;
  className?: string;
}) {
  return (
    <span className={cn("block text-xs font-normal text-muted-foreground", className)}>
      {periodNoteText(total, period, basis)}
    </span>
  );
}

/** "Yıllık · 12 ay" style pill for the billing period. */
export function PeriodBadge({
  period,
  className,
}: {
  period: "monthly" | "yearly";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground",
        className
      )}
    >
      {period === "yearly" ? "Yıllık · 12 ay" : "Aylık"}
    </span>
  );
}
