import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveIcon, type IconRef } from "./icon";

export interface ComparisonColumn {
  key: string;
  label: string;
  /** Emphasise this column (e.g. the popular plan). */
  highlight?: boolean;
  /** Footer cell content, e.g. <Price … /> or a CTA link. */
  footer?: React.ReactNode;
}

export type ComparisonValue = string | boolean | null | undefined;

export interface ComparisonRow {
  label: string;
  icon?: IconRef;
  values: Record<string, ComparisonValue>;
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

/**
 * Feature comparison.
 * - md+: real <table> inside a scrollable, rounded container.
 * - phones: one card per column with label/value rows (no horizontal scroll).
 */
export function ComparisonTable({
  columns,
  rows,
  caption,
  footerLabel = "Fiyat",
  className,
}: {
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
  /** Accessible caption (visually hidden). */
  caption?: string;
  footerLabel?: string;
  className?: string;
}) {
  const hasFooter = columns.some((col) => col.footer);

  return (
    <div className={className}>
      <div className="hidden overflow-x-auto rounded-xl border bg-background md:block">
        <table className="w-full min-w-[640px] text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b">
              <th
                scope="col"
                className="w-[28%] px-5 py-4 text-left font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
              >
                Özellik
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "px-4 py-4 text-center text-sm font-semibold",
                    col.highlight && "bg-muted/50"
                  )}
                >
                  {col.label}
                  {col.highlight ? (
                    <span className="mt-1 block font-mono text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                      Popüler
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const Icon = resolveIcon(row.icon);
              return (
                <tr key={row.label} className="border-b border-dashed last:border-b-0">
                  <th scope="row" className="px-5 py-3 text-left font-normal text-muted-foreground">
                    <span className="flex items-center gap-2">
                      {Icon ? <Icon aria-hidden className="size-4 shrink-0" /> : null}
                      {row.label}
                    </span>
                  </th>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn("px-4 py-3 text-center", col.highlight && "bg-muted/50")}
                    >
                      <Value value={row.values[col.key]} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {hasFooter ? (
            <tfoot>
              <tr className="border-t">
                <th scope="row" className="px-5 py-4 text-left font-medium">
                  {footerLabel}
                </th>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-4 py-4 text-center", col.highlight && "bg-muted/50")}
                  >
                    {col.footer}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {columns.map((col) => (
          <li
            key={col.key}
            className={cn(
              "rounded-xl border bg-background p-4",
              col.highlight && "ring-1 ring-foreground/20"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{col.label}</h3>
              {col.highlight ? (
                <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Popüler
                </span>
              ) : null}
            </div>
            <dl className="mt-3 divide-y divide-dashed text-sm">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="text-right">
                    <Value value={row.values[col.key]} />
                  </dd>
                </div>
              ))}
            </dl>
            {col.footer ? (
              <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 text-sm">
                <span className="font-medium">{footerLabel}</span>
                <span>{col.footer}</span>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
