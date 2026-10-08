import { CornerTicks } from "@/components/site/grid-lines";
import { cn } from "@/lib/utils";
import type { HostingResourceRow } from "./data";

const METRICS: { key: "cpu" | "ram" | "disk"; label: string; unit: string }[] = [
  { key: "cpu", label: "CPU", unit: "çekirdek" },
  { key: "ram", label: "RAM", unit: "GB" },
  { key: "disk", label: "Disk", unit: "GB" },
];

/**
 * Horizontal bars comparing CPU / RAM / disk per plan.
 * Values come from the products' `resourceLimits`; bars are relative to the largest plan.
 */
export function ResourceBars({
  rows,
  title = "kaynaklar / paket",
  className,
}: {
  rows: HostingResourceRow[];
  title?: string;
  className?: string;
}) {
  const metrics = METRICS.filter((metric) => rows.some((row) => row[metric.key]));
  if (rows.length === 0 || metrics.length === 0) return null;

  return (
    <figure className={cn("relative", className)}>
      <div className="relative overflow-hidden rounded-2xl border bg-background shadow-[0_24px_48px_-24px_rgba(0,0,0,0.25)] dark:shadow-none">
        <CornerTicks />
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </span>
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2 rounded-full bg-foreground/15" />
            <span className="size-2 rounded-full bg-foreground/15" />
            <span className="size-2 rounded-full bg-foreground/15" />
          </span>
        </div>
        <div className="divide-y divide-dashed">
          {metrics.map((metric) => {
            const max = Math.max(...rows.map((row) => row[metric.key] ?? 0));
            return (
              <div key={metric.key} className="px-5 py-5">
                <p className="mb-3 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <span>{metric.label}</span>
                  <span className="normal-case tracking-normal">{metric.unit}</span>
                </p>
                <dl className="space-y-2.5">
                  {rows.map((row) => {
                    const value = row[metric.key];
                    const width = value && max ? Math.max(6, (value / max) * 100) : 0;
                    return (
                      <div key={row.id} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 text-sm">
                        <dt className="truncate text-muted-foreground">{row.name}</dt>
                        <dd className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              row.featured ? "bg-foreground" : "bg-foreground/40"
                            )}
                            style={{ width: `${width}%` }}
                          />
                        </dd>
                        <dd className="w-12 text-right font-medium tabular-nums">
                          {value ?? "—"}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            );
          })}
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Değerler paket kayıtlarından alınır; çubuklar en büyük pakete göre orantılıdır.
      </figcaption>
    </figure>
  );
}
