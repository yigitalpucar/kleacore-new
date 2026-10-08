import { cn } from "@/lib/utils";
import { SectionCard } from "./section-card";

export type BarDatum = { label: string; value: number };

/**
 * Card with a dependency-free vertical bar chart (CSS bars + an sr-only data
 * table). Good enough for monthly revenue / counts; if you need lines, areas
 * or tooltips, add recharts and build a new chart inside the same card.
 */
export function ChartCard({
  title,
  description,
  actions,
  data,
  formatValue = (n) => n.toLocaleString("tr-TR"),
  height = 180,
  emptyText = "Bu dönem için veri yok.",
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  data: BarDatum[];
  formatValue?: (n: number) => string;
  height?: number;
  emptyText?: string;
  className?: string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  const hasData = data.length > 0 && max > 0;

  return (
    <SectionCard title={title} description={description} actions={actions} className={className}>
      {hasData ? (
        <figure>
          <div className="relative" style={{ height }}>
            {/* dashed guide lines */}
            <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="line-dashed-x w-full" />
              ))}
            </div>
            <div aria-hidden className="relative flex h-full items-end gap-1.5 sm:gap-2">
              {data.map((d) => (
                <div key={d.label} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.label}: ${formatValue(d.value)}`}>
                  <div
                    className="w-full rounded-t-[3px] bg-foreground/80 transition-colors group-hover:bg-foreground"
                    style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0)}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div aria-hidden className="mt-2 flex gap-1.5 sm:gap-2">
            {data.map((d) => (
              <span key={d.label} className="min-w-0 flex-1 truncate text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {d.label}
              </span>
            ))}
          </div>
          <table className="sr-only">
            <caption>{typeof title === "string" ? title : "Grafik verisi"}</caption>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}>
                  <th scope="row">{d.label}</th>
                  <td>{formatValue(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      ) : (
        <p className={cn("flex items-center justify-center text-sm text-muted-foreground")} style={{ height }}>
          {emptyText}
        </p>
      )}
    </SectionCard>
  );
}
