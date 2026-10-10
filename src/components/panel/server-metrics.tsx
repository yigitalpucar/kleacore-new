"use client";

import * as React from "react";
import { Activity, Loader2, RefreshCcw, TriangleAlert } from "lucide-react";
import { EmptyState, SectionCard, TimeSeriesChart, appButton } from "@/components/app";
import { getServerMetrics } from "@/lib/actions/customer/servers";
import {
  formatAxisTime,
  formatBytesPerSecond,
  formatMegabytes,
  formatPercent,
  formatPointTime,
  isValue,
  niceCeilBytes,
} from "@/lib/format/metrics";
import type { ServerMetricPoint, ServerMetricsRange } from "@/lib/modules/contracts";
import { cn } from "@/lib/utils";

const RANGES: { id: ServerMetricsRange; label: string; long: string }[] = [
  { id: "hour", label: "1 saat", long: "son 1 saat" },
  { id: "day", label: "24 saat", long: "son 24 saat" },
  { id: "week", label: "7 gün", long: "son 7 gün" },
];

type Loaded =
  | { state: "loading" }
  | { state: "unavailable" }
  | { state: "error"; message?: string }
  | { state: "ok"; points: ServerMetricPoint[] };

export const NO_METRICS_TEXT = "Ölçüm verisi bu sunucu için henüz yok";

/** Empty card for servers without a metrics source (legacy / not created yet). */
export function ServerMetricsUnavailable({ description }: { description?: string }) {
  return (
    <SectionCard title="Performans">
      <EmptyState
        compact
        icon={Activity}
        title={NO_METRICS_TEXT}
        description={description ?? "Sunucunuz otomasyon altyapımıza bağlandığında işlemci, bellek, ağ ve disk grafikleri burada görünür."}
      />
    </SectionCard>
  );
}

/**
 * CPU / RAM / network / disk I/O charts of a module-bound server for 1 h,
 * 24 h or 7 d, read through a server action (the browser never talks to the
 * hypervisor). Shows exactly what the module reports; no placeholder data.
 */
export function ServerMetrics({ serviceId }: { serviceId: string }) {
  const [range, setRange] = React.useState<ServerMetricsRange>("hour");
  const [cache, setCache] = React.useState<Partial<Record<ServerMetricsRange, Loaded>>>({});
  const [reloadKey, setReloadKey] = React.useState(0);
  const loaded = cache[range] ?? { state: "loading" as const };
  const rangeMeta = RANGES.find((r) => r.id === range)!;

  React.useEffect(() => {
    let cancelled = false;
    setCache((c) => ({ ...c, [range]: { state: "loading" } }));
    getServerMetrics(serviceId, range)
      .then((result) => {
        if (cancelled) return;
        let next: Loaded;
        if (!result.success) next = { state: "error", message: result.error };
        else if (result.metrics.status === "unavailable") next = { state: "unavailable" };
        else if (result.metrics.status === "error") next = { state: "error" };
        else next = { state: "ok", points: result.metrics.points };
        setCache((c) => ({ ...c, [range]: next }));
      })
      .catch(() => {
        if (!cancelled) setCache((c) => ({ ...c, [range]: { state: "error" } }));
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, range, reloadKey]);

  if (loaded.state === "unavailable") return <ServerMetricsUnavailable />;

  const points = loaded.state === "ok" ? loaded.points : [];
  const times = points.map((p) => p.time);
  const memTotal = Math.max(0, ...points.map((p) => p.memTotalMB ?? 0));
  const hasAny = points.some(
    (p) =>
      p.cpuPercent !== undefined ||
      p.memUsedMB !== undefined ||
      p.netInBps !== undefined ||
      p.netOutBps !== undefined ||
      p.diskReadBps !== undefined ||
      p.diskWriteBps !== undefined
  );
  const axis = (ms: number) => formatAxisTime(ms, range);
  const byteMax = (...keys: (keyof ServerMetricPoint)[]) =>
    niceCeilBytes(Math.max(0, ...points.flatMap((p) => keys.map((k) => p[k]).filter(isValue)))) || undefined;

  return (
    <SectionCard
      title="Performans"
      description="Hipervizörün ölçtüğü ortalama değerler."
      actions={
        <div className="flex items-center gap-1">
          <div role="group" aria-label="Zaman aralığı" className="inline-flex rounded-md border bg-muted/40 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={range === r.id}
                onClick={() => setRange(r.id)}
                className={cn(
                  "inline-flex h-11 min-w-11 items-center justify-center rounded px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-7",
                  range === r.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Grafikleri yenile"
            className={appButton({ variant: "ghost", size: "icon-sm" })}
            disabled={loaded.state === "loading"}
            onClick={() => setReloadKey((k) => k + 1)}
          >
            {loaded.state === "loading" ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCcw aria-hidden />}
          </button>
        </div>
      }
    >
      {loaded.state === "loading" ? (
        <div role="status" aria-label="Grafikler yükleniyor" className="grid gap-6 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              <div className="h-[140px] animate-pulse rounded-md bg-muted/60 motion-reduce:animate-none" />
              <div className="h-3" />
            </div>
          ))}
        </div>
      ) : loaded.state === "error" ? (
        <EmptyState
          compact
          icon={TriangleAlert}
          title="Ölçümler şu anda alınamadı"
          description={loaded.message ?? "Sunucuya bağlanırken bir sorun oluştu; biraz sonra tekrar deneyin."}
          action={
            <button type="button" className={appButton({ variant: "outline", size: "sm" })} onClick={() => setReloadKey((k) => k + 1)}>
              <RefreshCcw aria-hidden />
              Tekrar dene
            </button>
          }
        />
      ) : !hasAny ? (
        <EmptyState
          compact
          icon={Activity}
          title={NO_METRICS_TEXT}
          description={`Hipervizör ${rangeMeta.long} için ölçüm kaydetmemiş; yeni açılan veya kapalı sunucularda grafikler birkaç dakika içinde dolar.`}
        />
      ) : (
        <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
          <MetricBlock title="İşlemci">
            <TimeSeriesChart
              label={`İşlemci kullanımı, ${rangeMeta.long}`}
              times={times}
              series={[{ id: "cpu", label: "CPU", values: points.map((p) => p.cpuPercent) }]}
              max={100}
              formatValue={formatPercent}
              formatTime={axis}
              formatTooltipTime={formatPointTime}
            />
          </MetricBlock>
          <MetricBlock title="Bellek" hint={memTotal ? `Toplam ${formatMegabytes(memTotal)}` : undefined}>
            <TimeSeriesChart
              label={`Bellek kullanımı, ${rangeMeta.long}`}
              times={times}
              series={[{ id: "mem", label: "Kullanılan", values: points.map((p) => p.memUsedMB) }]}
              max={memTotal || undefined}
              formatValue={formatMegabytes}
              formatTime={axis}
              formatTooltipTime={formatPointTime}
            />
          </MetricBlock>
          <MetricBlock title="Ağ trafiği">
            <TimeSeriesChart
              label={`Ağ trafiği, ${rangeMeta.long}`}
              times={times}
              series={[
                { id: "in", label: "Gelen", values: points.map((p) => p.netInBps) },
                { id: "out", label: "Giden", values: points.map((p) => p.netOutBps), variant: "dashed" },
              ]}
              max={byteMax("netInBps", "netOutBps")}
              formatValue={formatBytesPerSecond}
              formatTime={axis}
              formatTooltipTime={formatPointTime}
            />
          </MetricBlock>
          <MetricBlock title="Disk G/Ç">
            <TimeSeriesChart
              label={`Disk okuma ve yazma, ${rangeMeta.long}`}
              times={times}
              series={[
                { id: "read", label: "Okuma", values: points.map((p) => p.diskReadBps) },
                { id: "write", label: "Yazma", values: points.map((p) => p.diskWriteBps), variant: "dashed" },
              ]}
              max={byteMax("diskReadBps", "diskWriteBps")}
              formatValue={formatBytesPerSecond}
              formatTime={axis}
              formatTooltipTime={formatPointTime}
            />
          </MetricBlock>
        </div>
      )}
    </SectionCard>
  );
}

function MetricBlock({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}
