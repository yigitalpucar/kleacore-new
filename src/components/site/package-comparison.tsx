"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTRY, type BillingPeriod } from "@/lib/format/price";
import { periodTotal } from "@/lib/billing/period-price";
import {
  FEATURED_LABEL,
  type PackageColumn,
  type PackageComparisonData,
  type PackageRow,
} from "@/lib/catalog/package-comparison";
import type { ComparisonValue } from "./comparison-table";
import { resolveIcon } from "./icon";
import { Price } from "./price";

const GROUP_LABELS: Record<PackageRow["group"], string> = {
  features: "Kaynaklar ve özellikler",
  included: "Pakete dahil hizmetler",
};

/** Monthly-equivalent price shown for a column in the chosen period. */
export function columnPrice(col: PackageColumn, billing: BillingPeriod) {
  const yearly = billing === "yearly" && col.yearlyMonthlyPrice !== null;
  return { yearly, amount: yearly ? (col.yearlyMonthlyPrice as number) : col.monthlyPrice };
}

function Value({ value }: { value: ComparisonValue }) {
  if (value === true) {
    return (
      <>
        <Check aria-hidden className="inline size-4" />
        <span className="sr-only">Var</span>
      </>
    );
  }
  if (value === false || value === null || value === undefined || value === "") {
    return (
      <>
        <Minus aria-hidden className="inline size-4 text-muted-foreground/60" />
        <span className="sr-only">Yok</span>
      </>
    );
  }
  return <span className="font-medium tabular-nums">{value}</span>;
}

export function FeaturedTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border border-foreground/30 px-1.5 py-0.5 font-mono text-[10px] font-normal uppercase leading-tight tracking-wider text-foreground",
        className
      )}
    >
      {FEATURED_LABEL}
    </span>
  );
}

/**
 * Package-by-package comparison from DB records (see buildPackageComparison).
 *
 * - md+: one table with a sticky header (name, price for the page's billing
 *   period, per-package yearly saving, action) under the site header.
 * - phones: a two-package picker; the same table with the two chosen
 *   packages side by side — readable at 375px, no horizontal scrolling.
 */
export function PackageComparison({
  data,
  billing,
  caption,
  renderAction,
  className,
}: {
  data: PackageComparisonData;
  billing: BillingPeriod;
  caption: string;
  renderAction?: (column: PackageColumn, size: "sm" | "md") => React.ReactNode;
  className?: string;
}) {
  const { columns, rows } = data;
  const featuredIndex = Math.max(0, columns.findIndex((col) => col.featured));
  const [pair, setPair] = useState<[number, number]>(() => {
    const second = featuredIndex + 1 < columns.length ? featuredIndex + 1 : featuredIndex - 1;
    return [featuredIndex, Math.max(0, second)];
  });
  const pickerId = useId();

  if (columns.length === 0 || rows.length === 0) return null;

  const choose = (slot: 0 | 1, index: number) => {
    setPair((current) => {
      const next: [number, number] = [...current];
      const other = slot === 0 ? 1 : 0;
      // Picking the package already in the other slot swaps the two.
      if (current[other] === index) next[other] = current[slot];
      next[slot] = index;
      return next;
    });
  };

  const mobileColumns = columns.length > 1 ? [columns[pair[0]], columns[pair[1]]] : columns;

  return (
    <div className={className}>
      {columns.length > 2 ? (
        <fieldset className="mb-4 md:hidden">
          <legend className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Karşılaştırılacak paketler
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {([0, 1] as const).map((slot) => (
              <div key={slot} className="relative">
                <label htmlFor={`${pickerId}-${slot}`} className="sr-only">
                  {slot === 0 ? "Birinci paket" : "İkinci paket"}
                </label>
                <select
                  id={`${pickerId}-${slot}`}
                  value={pair[slot]}
                  onChange={(event) => choose(slot, Number(event.target.value))}
                  className="h-11 w-full appearance-none rounded-lg border bg-background pl-3 pr-9 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {columns.map((col, index) => (
                    <option key={col.key} value={index}>
                      {col.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden
                  className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
              </div>
            ))}
          </div>
        </fieldset>
      ) : null}

      <ComparisonGrid
        className="md:hidden"
        columns={mobileColumns}
        rows={rows}
        billing={billing}
        caption={caption}
        renderAction={renderAction}
        compact
      />
      <ComparisonGrid
        className="hidden md:block"
        columns={columns}
        rows={rows}
        billing={billing}
        caption={caption}
        renderAction={renderAction}
      />
    </div>
  );
}

function ComparisonGrid({
  columns,
  rows,
  billing,
  caption,
  renderAction,
  compact = false,
  className,
}: {
  columns: PackageColumn[];
  rows: PackageRow[];
  billing: BillingPeriod;
  caption: string;
  renderAction?: (column: PackageColumn, size: "sm" | "md") => React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const groups = (["features", "included"] as const)
    .map((group) => ({ group, rows: rows.filter((row) => row.group === group) }))
    .filter((g) => g.rows.length > 0);
  const showGroupHeads = groups.length > 1;
  const highlight = (col: PackageColumn) => col.featured && "bg-muted/60 dark:bg-muted/40";

  return (
    // overflow-clip (not hidden/auto) keeps the rounded corners without
    // turning the wrapper into a scroll container, so the header can stick.
    <div className={cn("overflow-clip rounded-xl border bg-background", className)}>
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className={cn(
                "sticky top-16 z-10 border-b bg-background text-left align-bottom font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground",
                compact ? "w-[34%] px-3 py-3" : "w-[24%] px-5 py-4"
              )}
            >
              Paket
            </th>
            {columns.map((col) => {
              const { yearly, amount } = columnPrice(col, billing);
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-label={col.label}
                  className={cn(
                    "sticky top-16 z-10 border-b border-l border-l-border/60 bg-background text-left align-top font-normal",
                    compact ? "px-3 py-3" : "px-4 py-4",
                    col.featured && "bg-muted dark:bg-muted"
                  )}
                >
                  <span className="flex min-h-full flex-col gap-1.5">
                    {col.featured ? <FeaturedTag className="self-start" /> : null}
                    <span className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
                      {col.label}
                    </span>
                    <Price amount={amount} period="ay" size={compact ? "sm" : "md"} vatNote={false} />
                    <span
                      className={cn(
                        "min-h-4 text-[11px] leading-tight text-muted-foreground",
                        compact && billing !== "yearly" && "sr-only"
                      )}
                    >
                      {yearly ? (
                        <>
                          {formatTRY(periodTotal(amount, "yearly", "monthly-equivalent"))}/yıl
                          {col.savingsPercent > 0 ? (
                            <span className="ml-1 rounded-full border px-1.5 py-px font-mono text-[10px] uppercase text-foreground">
                              %{col.savingsPercent} tasarruf
                            </span>
                          ) : null}
                        </>
                      ) : billing === "yearly" ? (
                        "Yalnızca aylık"
                      ) : (
                        "Aylık ödeme"
                      )}
                    </span>
                    {renderAction && !compact ? <span className="mt-1">{renderAction(col, "md")}</span> : null}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        {groups.map(({ group, rows: groupRows }) => (
          <tbody key={group}>
            {showGroupHeads ? (
              <tr>
                <th
                  scope="colgroup"
                  colSpan={columns.length + 1}
                  className={cn(
                    "border-b bg-muted/40 text-left font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground",
                    compact ? "px-3 py-2" : "px-5 py-2.5"
                  )}
                >
                  {GROUP_LABELS[group]}
                </th>
              </tr>
            ) : null}
            {groupRows.map((row, index) => {
              const Icon = resolveIcon(row.icon);
              const last = index === groupRows.length - 1;
              return (
                <tr key={row.label}>
                  <th
                    scope="row"
                    className={cn(
                      "text-left font-normal text-muted-foreground",
                      compact ? "px-3 py-2.5 text-[13px]" : "px-5 py-3",
                      !last && "border-b border-dashed"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {Icon && !compact ? <Icon aria-hidden className="size-4 shrink-0" /> : null}
                      {row.label}
                    </span>
                  </th>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "border-l border-l-border/60 break-words",
                        compact ? "px-3 py-2.5 text-[13px]" : "px-4 py-3",
                        !last && "border-b border-dashed",
                        highlight(col)
                      )}
                    >
                      <Value value={row.values[col.key]} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        ))}
        {renderAction && compact ? (
          <tfoot>
            <tr>
              <td className="border-t px-3 py-3" />
              {columns.map((col) => (
                <td key={col.key} className={cn("border-l border-t border-l-border/60 px-3 py-3", highlight(col))}>
                  {renderAction(col, "sm")}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
