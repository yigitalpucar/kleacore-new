import { ToneDot, type StatusTone } from "@/components/app";
import { cn } from "@/lib/utils";

/**
 * Report breakdowns adapted from shadcnblocks `chart-card4` (horizontal bars
 * with category labels) and `chart-card11` (100% stacked bar). Rebuilt with
 * CSS on our monochrome tokens: no chart dependency, colour only in dots.
 */

export type BreakdownItem = {
  key: string;
  label: string;
  value: number;
  /** Display text for the value (money, count…). Defaults to tr-TR number. */
  display?: string;
  tone?: StatusTone;
};

function percentOf(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

/** Horizontal bars, one row per category (chart-card4). */
export function BreakdownBars({
  items,
  total: totalProp,
  emptyText = "Seçilen dönemde kayıt yok.",
  className,
}: {
  items: BreakdownItem[];
  total?: number;
  emptyText?: string;
  className?: string;
}) {
  const total = totalProp ?? items.reduce((sum, i) => sum + i.value, 0);

  if (items.length === 0 || total <= 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className={cn("space-y-4", className)}>
      {items.map((item) => {
        const pct = percentOf(item.value, total);
        return (
          <li key={item.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {item.tone ? <ToneDot tone={item.tone} /> : null}
                <span className="truncate text-muted-foreground">{item.label}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="font-medium tabular-nums">{item.display ?? item.value.toLocaleString("tr-TR")}</span>
                <span className="w-10 text-right font-mono text-[11px] tabular-nums text-muted-foreground">%{pct}</span>
              </span>
            </div>
            <div
              role="meter"
              aria-label={item.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-foreground/80" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const SHADES = ["bg-foreground", "bg-foreground/60", "bg-foreground/35", "bg-foreground/15", "bg-foreground/[0.08]"];

/** One 100% stacked bar + legend (chart-card11). */
export function StackedShareBar({
  items,
  emptyText = "Seçilen dönemde kayıt yok.",
}: {
  items: BreakdownItem[];
  emptyText?: string;
}) {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  if (items.length === 0 || total <= 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-5">
      <div aria-hidden className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {items.map((item, index) => (
          <div
            key={item.key}
            className={cn("h-full border-r border-card last:border-r-0", SHADES[index % SHADES.length])}
            style={{ width: `${(item.value / total) * 100}%` }}
            title={`${item.label}: ${item.value.toLocaleString("tr-TR")}`}
          />
        ))}
      </div>
      <ul className="divide-y divide-dashed text-sm">
        {items.map((item, index) => (
          <li key={item.key} className="flex min-h-10 items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <span className="flex min-w-0 items-center gap-2.5">
              <span aria-hidden className={cn("size-2.5 shrink-0 rounded-[3px] ring-1 ring-border", SHADES[index % SHADES.length])} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="font-medium tabular-nums">{item.display ?? item.value.toLocaleString("tr-TR")}</span>
              <span className="w-10 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                %{percentOf(item.value, total)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
