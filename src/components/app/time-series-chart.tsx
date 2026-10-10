"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { areaPath, isValue, linePath, niceCeil, seriesStats, type SeriesValue } from "@/lib/format/metrics";

export type TimeSeries = {
  id: string;
  label: string;
  values: readonly SeriesValue[];
  /** Second series of a pair (out / write) is drawn dashed in muted ink. */
  variant?: "solid" | "dashed";
};

const W = 600;

/**
 * Dependency-free line chart for metrics (monochrome, kit tokens): SVG lines
 * with a soft area under the first series, gaps left open, hover/keyboard
 * crosshair with a value tooltip, and an sr-only summary table.
 * Values are drawn as given; nothing is smoothed or interpolated.
 */
export function TimeSeriesChart({
  label,
  times,
  series,
  formatValue,
  formatTime,
  formatTooltipTime = formatTime,
  max: fixedMax,
  height = 140,
  className,
}: {
  /** Accessible name, e.g. "CPU kullanımı, son 24 saat". */
  label: string;
  /** Epoch ms per point (same length as every series' values). */
  times: readonly number[];
  series: readonly TimeSeries[];
  formatValue: (n: number) => string;
  formatTime: (ms: number) => string;
  formatTooltipTime?: (ms: number) => string;
  /** Fixed axis maximum (100 for %); otherwise a nice value above the data. */
  max?: number;
  height?: number;
  className?: string;
}) {
  const [active, setActive] = React.useState<number | null>(null);
  const n = times.length;
  const dataMax = Math.max(0, ...series.flatMap((s) => s.values.filter(isValue)));
  const max = fixedMax ?? (niceCeil(dataMax) || 1);
  const H = height;

  const indexAt = (clientX: number, rect: DOMRect) => {
    if (n < 1) return null;
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    return Math.round(ratio * (n - 1));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!n) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((i) => {
        const cur = i ?? n - 1;
        return Math.min(Math.max(cur + (e.key === "ArrowRight" ? 1 : -1), 0), n - 1);
      });
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(n - 1);
    } else if (e.key === "Escape") {
      setActive(null);
    }
  };

  const activeLeft = active != null && n > 1 ? (active / (n - 1)) * 100 : 50;
  const tooltipSide = activeLeft > 60 ? "right" : "left";

  return (
    <figure className={cn("min-w-0", className)}>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
        {series.map((s) => {
          const stats = seriesStats(s.values);
          return (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <svg width="16" height="6" className="shrink-0">
                <line
                  x1="0"
                  y1="3"
                  x2="16"
                  y2="3"
                  strokeWidth="2"
                  className={s.variant === "dashed" ? "stroke-muted-foreground" : "stroke-foreground"}
                  strokeDasharray={s.variant === "dashed" ? "3 2" : undefined}
                />
              </svg>
              {s.label}
              {stats ? <span className="font-mono tabular-nums text-foreground">{formatValue(stats.last)}</span> : null}
            </span>
          );
        })}
      </div>

      <div
        role="group"
        aria-roledescription="grafik"
        aria-label={`${label}. Noktalar arasında ok tuşlarıyla gezinebilirsiniz.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerMove={(e) => setActive(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        className="relative touch-pan-y rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        style={{ height: H }}
      >
        {/* dashed guides + y labels */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[max, max / 2, 0].map((v, i) => (
            <div key={i} className="relative border-t border-dashed border-border/80">
              {i < 2 ? (
                <span className="absolute left-0 top-0.5 bg-card/80 pr-1 font-mono text-[10px] leading-none text-muted-foreground">
                  {formatValue(v)}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <svg
          aria-hidden
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
        >
          {series[0] ? <path d={areaPath(series[0].values, W, H, max)} className="fill-foreground/[0.06]" /> : null}
          {series.map((s) => (
            <path
              key={s.id}
              d={linePath(s.values, W, H, max)}
              fill="none"
              strokeWidth={s.variant === "dashed" ? 1.5 : 1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.variant === "dashed" ? "4 3" : undefined}
              vectorEffect="non-scaling-stroke"
              className={s.variant === "dashed" ? "stroke-muted-foreground" : "stroke-foreground"}
            />
          ))}
        </svg>

        {active != null && n ? (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px bg-foreground/40"
              style={{ left: `${activeLeft}%` }}
            />
            <div
              aria-live="polite"
              className={cn(
                "pointer-events-none absolute top-1 z-10 min-w-[140px] rounded-md border bg-popover px-2.5 py-2 text-xs shadow-md",
                tooltipSide === "left" ? "ml-2" : "-translate-x-full -ml-2"
              )}
              style={{ left: `${activeLeft}%` }}
            >
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {formatTooltipTime(times[active])}
              </p>
              {series.map((s) => {
                const v = s.values[active];
                return (
                  <p key={s.id} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-medium tabular-nums">{isValue(v) ? formatValue(v) : "—"}</span>
                  </p>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      {n ? (
        <div aria-hidden className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>{formatTime(times[0])}</span>
          {n > 2 ? <span className="hidden sm:inline">{formatTime(times[Math.floor((n - 1) / 2)])}</span> : null}
          <span>{formatTime(times[n - 1])}</span>
        </div>
      ) : null}

      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Seri</th>
            <th scope="col">Son</th>
            <th scope="col">Ortalama</th>
            <th scope="col">En yüksek</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s) => {
            const stats = seriesStats(s.values);
            return (
              <tr key={s.id}>
                <th scope="row">{s.label}</th>
                <td>{stats ? formatValue(stats.last) : "—"}</td>
                <td>{stats ? formatValue(stats.avg) : "—"}</td>
                <td>{stats ? formatValue(stats.max) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </figure>
  );
}
