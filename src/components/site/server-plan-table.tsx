import Link from "next/link";
import { cn } from "@/lib/utils";
import type { BillingPeriod } from "@/lib/format/price";
import { buttonClasses } from "./button-classes";
import { Price } from "./price";

export interface ServerPlanSpecColumn {
  key: string;
  label: string;
}

/** Serializable server (VDS/VPS/dedicated) plan row. */
export interface ServerPlanRow {
  id: string;
  name: string;
  featured?: boolean;
  /** Values keyed by ServerPlanSpecColumn.key (e.g. cpu, ram, disk). */
  specs: Record<string, string>;
  monthlyPrice: number;
  yearlyMonthlyPrice?: number | null;
  href: string;
  ctaLabel?: string;
}

export const defaultServerSpecColumns: ServerPlanSpecColumn[] = [
  { key: "cpu", label: "İşlemci" },
  { key: "ram", label: "Bellek" },
  { key: "disk", label: "Disk" },
  { key: "traffic", label: "Trafik" },
];

/**
 * Server plans as a spec table on desktop and stacked cards on phones —
 * never scrolls horizontally. Pair with a BillingSwitch for `billing`.
 */
export function ServerPlanTable({
  plans,
  billing = "monthly",
  columns = defaultServerSpecColumns,
  caption,
  className,
}: {
  plans: ServerPlanRow[];
  billing?: BillingPeriod;
  columns?: ServerPlanSpecColumn[];
  /** Accessible table caption (visually hidden). */
  caption?: string;
  className?: string;
}) {
  const priceOf = (plan: ServerPlanRow) =>
    billing === "yearly" && plan.yearlyMonthlyPrice ? plan.yearlyMonthlyPrice : plan.monthlyPrice;

  return (
    <div className={className}>
      {/* Desktop / tablet: table */}
      <div className="hidden overflow-hidden rounded-xl border bg-background md:block">
        <table className="w-full text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b bg-muted/40 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th scope="col" className="px-5 py-3 font-medium">Paket</th>
              {columns.map((col) => (
                <th key={col.key} scope="col" className="px-4 py-3 font-medium">
                  {col.label}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right font-medium">Fiyat</th>
              <th scope="col" className="px-5 py-3">
                <span className="sr-only">İşlem</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr
                key={plan.id}
                className={cn(
                  "border-b border-dashed last:border-b-0 transition-colors hover:bg-muted/30",
                  plan.featured && "bg-muted/40"
                )}
              >
                <th scope="row" className="px-5 py-4 text-left font-semibold">
                  <span className="flex items-center gap-2">
                    {plan.name}
                    {plan.featured ? (
                      <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                        Popüler
                      </span>
                    ) : null}
                  </span>
                </th>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-4 tabular-nums">
                    {plan.specs[col.key] || "—"}
                  </td>
                ))}
                <td className="px-4 py-4 text-right">
                  <Price amount={priceOf(plan)} period="ay" size="md" />
                </td>
                <td className="px-5 py-4 text-right">
                  <Link
                    href={plan.href}
                    className={buttonClasses({
                      variant: plan.featured ? "primary" : "outline",
                      size: "sm",
                      className: "min-h-10",
                    })}
                    aria-label={`${plan.name} paketini incele`}
                  >
                    {plan.ctaLabel ?? "İncele"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone: stacked cards */}
      <ul className="grid gap-3 md:hidden">
        {plans.map((plan) => (
          <li
            key={plan.id}
            className={cn(
              "rounded-xl border bg-background p-4",
              plan.featured && "ring-1 ring-foreground/20"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{plan.name}</h3>
              {plan.featured ? (
                <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Popüler
                </span>
              ) : null}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {columns.map((col) => (
                <div key={col.key} className="min-w-0">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {col.label}
                  </dt>
                  <dd className="truncate font-medium">{plan.specs[col.key] || "—"}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-dashed pt-4">
              <Price amount={priceOf(plan)} period="ay" size="md" />
              <Link
                href={plan.href}
                className={buttonClasses({ variant: plan.featured ? "primary" : "outline", size: "md" })}
                aria-label={`${plan.name} paketini incele`}
              >
                {plan.ctaLabel ?? "İncele"}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
