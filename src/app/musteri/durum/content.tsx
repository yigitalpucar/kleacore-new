import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, Wrench, XCircle } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { Eyebrow } from "@/components/site/eyebrow";
import { GridLineHorizontal, GridLineVertical } from "@/components/site/grid-lines";
import { SiteShell } from "@/components/site/kurumsal/site-shell";
import { cn } from "@/lib/utils";
import { RefreshButton, SubscribeForm } from "./client";
import {
  componentMeta,
  dayKey,
  formatDateTime,
  formatDay,
  formatDuration,
  formatTime,
  incidentLabel,
  parseUpdates,
  severityOf,
  toneDot,
  type Tone,
} from "./status-meta";

export interface StatusComponent {
  id: string;
  serviceName: string;
  status: string;
  description: string;
  updatedAt: string;
  createdAt: string;
}

export interface StatusIncident {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  serviceName: string;
  startedAt: string;
  resolvedAt: string | null;
  updates: unknown;
  updatedAt: string;
}

interface DurumContentProps {
  components: StatusComponent[];
  incidents: StatusIncident[];
  historyDays: number;
  generatedAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Days shown on phones (the rest are hidden below `sm`). */
const MOBILE_DAYS = 30;

function sameService(a: string, b: string) {
  return a.trim().toLocaleLowerCase("tr-TR") === b.trim().toLocaleLowerCase("tr-TR");
}

function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", toneDot[tone], className)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Overall banner                                                      */
/* ------------------------------------------------------------------ */

function overallState(components: StatusComponent[], active: StatusIncident[]) {
  const statuses = components.map((c) => c.status);
  const worstSeverity = active.reduce((max, i) => Math.max(max, severityOf(i.severity).rank), 0);

  if (statuses.includes("MAJOR_OUTAGE") || worstSeverity === 3) {
    return { tone: "critical" as Tone, icon: XCircle, title: "Büyük kesinti yaşanıyor" };
  }
  if (statuses.includes("PARTIAL_OUTAGE") || worstSeverity === 2) {
    return { tone: "major" as Tone, icon: AlertTriangle, title: "Bazı hizmetlerde kesinti var" };
  }
  if (statuses.includes("DEGRADED") || worstSeverity === 1) {
    return { tone: "warn" as Tone, icon: AlertTriangle, title: "Bazı hizmetlerde performans düşüklüğü" };
  }
  if (statuses.includes("MAINTENANCE")) {
    return { tone: "info" as Tone, icon: Wrench, title: "Planlı bakım devam ediyor" };
  }
  if (components.length === 0) {
    return { tone: "neutral" as Tone, icon: Info, title: "Bildirilmiş aktif bir olay yok" };
  }
  return { tone: "ok" as Tone, icon: CheckCircle2, title: "Tüm hizmetler çalışıyor" };
}

function OverallBanner({
  components,
  active,
  lastUpdate,
}: {
  components: StatusComponent[];
  active: StatusIncident[];
  lastUpdate: string | null;
}) {
  const state = overallState(components, active);
  const Icon = state.icon;
  return (
    <div
      role="status"
      className="relative mx-auto flex max-w-2xl flex-col items-start gap-4 rounded-xl border bg-background/80 p-5 text-left shadow-sm backdrop-blur sm:flex-row sm:items-center sm:p-6"
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full text-white",
          toneDot[state.tone]
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold tracking-tight">{state.title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {active.length > 0
            ? `${active.length} devam eden olay`
            : components.length > 0
              ? `${components.length} bileşen izleniyor`
              : "Bileşen durumları henüz yayımlanmadı."}
          {lastUpdate ? ` · Son güncelleme: ${formatDateTime(lastUpdate)}` : ""}
        </p>
      </div>
      <RefreshButton />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 90-day incident bar (real incident records only)                    */
/* ------------------------------------------------------------------ */

interface DayCell {
  key: string;
  label: string;
  tone: Tone | null;
  count: number;
  /** Day before the component was added to the status page. */
  untracked: boolean;
}

function buildDays(
  incidents: StatusIncident[],
  historyDays: number,
  nowIso: string,
  trackedSinceIso: string
): DayCell[] {
  const trackedSince = dayKey(trackedSinceIso);
  const now = Date.parse(nowIso);
  const worst = new Map<string, { rank: number; tone: Tone; count: number }>();

  for (const incident of incidents) {
    const start = Date.parse(incident.startedAt);
    const end = incident.resolvedAt ? Date.parse(incident.resolvedAt) : now;
    const sev = severityOf(incident.severity);
    const keys = new Set<string>();
    for (let t = start; t <= end; t += DAY_MS) keys.add(dayKey(t));
    keys.add(dayKey(end));
    for (const key of keys) {
      const prev = worst.get(key);
      worst.set(key, {
        rank: Math.max(prev?.rank ?? 0, sev.rank),
        tone: !prev || sev.rank > prev.rank ? sev.tone : prev.tone,
        count: (prev?.count ?? 0) + 1,
      });
    }
  }

  const days: DayCell[] = [];
  for (let i = historyDays - 1; i >= 0; i -= 1) {
    const t = now - i * DAY_MS;
    const key = dayKey(t);
    const hit = worst.get(key);
    days.push({
      key,
      label: formatDay(new Date(t).toISOString()),
      tone: hit?.tone ?? null,
      count: hit?.count ?? 0,
      untracked: key < trackedSince && !hit,
    });
  }
  return days;
}

function IncidentBar({ days, name }: { days: DayCell[]; name: string }) {
  const incidentDays = days.filter((d) => d.count > 0).length;
  return (
    <div>
      <p className="sr-only">
        {name}: son {days.length} günde {incidentDays > 0 ? `${incidentDays} günde olay kaydı var` : "kayıtlı olay yok"}.
      </p>
      <div aria-hidden className="flex h-8 items-stretch gap-[2px]">
        {days.map((day, index) => (
          <span
            key={day.key}
            title={`${day.label}: ${
              day.count > 0 ? `${day.count} olay` : day.untracked ? "Henüz izlenmiyordu" : "Kayıtlı olay yok"
            }`}
            className={cn(
              "min-w-0 flex-1 rounded-[2px] transition-opacity hover:opacity-70",
              day.tone
                ? toneDot[day.tone]
                : day.untracked
                  ? "bg-muted"
                  : "bg-emerald-500/70 dark:bg-emerald-500/60",
              index < days.length - MOBILE_DAYS && "hidden sm:block"
            )}
          />
        ))}
      </div>
      <div
        aria-hidden
        className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
      >
        <span className="sm:hidden">{MOBILE_DAYS} gün önce</span>
        <span className="hidden sm:inline">{days.length} gün önce</span>
        <span className="hidden sm:inline">
          {incidentDays > 0 ? `${incidentDays} günde olay` : "Kayıtlı olay yok"}
        </span>
        <span>Bugün</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Incident card                                                       */
/* ------------------------------------------------------------------ */

function IncidentCard({ incident, nowIso }: { incident: StatusIncident; nowIso: string }) {
  const sev = severityOf(incident.severity);
  const resolved = incident.status === "RESOLVED";
  const updates = parseUpdates(incident.updates);
  const end = incident.resolvedAt ?? (resolved ? incident.updatedAt : nowIso);

  return (
    <article className="rounded-xl border bg-background p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium">
          <Dot tone={resolved ? "ok" : sev.tone} />
          {incidentLabel(incident.status)}
        </span>
        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {sev.label}
        </span>
        <span className="text-xs text-muted-foreground">{incident.serviceName}</span>
      </div>
      <h3 className="mt-3 text-lg font-semibold tracking-tight">{incident.title}</h3>
      {incident.description ? (
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
          {incident.description}
        </p>
      ) : null}

      {updates.length > 0 ? (
        <ol className="mt-4 space-y-3 border-l border-dashed pl-4">
          {updates.map((u, index) => (
            <li key={`${u.at ?? "x"}-${index}`} className="relative text-sm">
              <span
                aria-hidden
                className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-foreground/60 ring-2 ring-background"
              />
              <p className="font-medium">
                {u.status ? incidentLabel(u.status) : "Güncelleme"}
                {u.at ? (
                  <time dateTime={u.at} className="ml-2 font-normal text-muted-foreground">
                    {formatDateTime(u.at)}
                  </time>
                ) : null}
              </p>
              <p className="mt-0.5 leading-relaxed text-muted-foreground">{u.message}</p>
            </li>
          ))}
        </ol>
      ) : null}

      <dl className="mt-4 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
        <div className="flex gap-1.5">
          <dt>Başlangıç:</dt>
          <dd className="text-foreground">
            <time dateTime={incident.startedAt}>{formatDateTime(incident.startedAt)}</time>
          </dd>
        </div>
        {resolved && incident.resolvedAt ? (
          <div className="flex gap-1.5">
            <dt>Çözüm:</dt>
            <dd className="text-foreground">
              <time dateTime={incident.resolvedAt}>{formatTime(incident.resolvedAt)}</time>
            </dd>
          </div>
        ) : null}
        <div className="flex gap-1.5">
          <dt>{resolved ? "Süre:" : "Geçen süre:"}</dt>
          <dd className="text-foreground">{formatDuration(incident.startedAt, end)}</dd>
        </div>
      </dl>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function DurumContent({ components, incidents, historyDays, generatedAt }: DurumContentProps) {
  const active = incidents.filter((i) => i.status !== "RESOLVED");
  const resolved = incidents.filter((i) => i.status === "RESOLVED");
  const maintenance = components.filter((c) => c.status === "MAINTENANCE");

  const lastUpdate =
    [...components.map((c) => c.updatedAt), ...incidents.map((i) => i.updatedAt)].sort().at(-1) ??
    null;

  // Resolved incidents grouped by Istanbul calendar day (newest first).
  const groups = new Map<string, StatusIncident[]>();
  for (const incident of resolved) {
    const key = dayKey(incident.startedAt);
    groups.set(key, [...(groups.get(key) ?? []), incident]);
  }

  return (
    <SiteShell>
      <PageHeader
        eyebrow="Sistem durumu"
        title="Sistem Durumu"
        description="Hizmetlerimizin güncel durumu, devam eden olaylar, planlı bakımlar ve son 90 günün olay geçmişi."
        breadcrumbs={[{ label: "Sistem Durumu" }]}
      >
        <OverallBanner components={components} active={active} lastUpdate={lastUpdate} />
      </PageHeader>

      {active.length > 0 ? (
        <Section spacing="sm" aria-labelledby="aktif-olaylar" containerClassName="max-w-4xl">
          <SectionHeading
            id="aktif-olaylar"
            eyebrow="Devam ediyor"
            title="Aktif olaylar"
            className="mb-8"
          />
          <div className="space-y-4">
            {active.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} nowIso={generatedAt} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        aria-labelledby="bilesenler"
        containerClassName="max-w-4xl"
        divider={active.length > 0}
        spacing={active.length > 0 ? "default" : "sm"}
      >
        <SectionHeading
          id="bilesenler"
          eyebrow="Bileşenler"
          title="Hizmet durumları"
          description={
            components.length > 0
              ? `Her çubuk bir günü gösterir; renkli günlerde ilgili bileşen için kayıtlı bir olay vardır. Son ${historyDays} gün.`
              : undefined
          }
          className="mb-8"
        />

        {components.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center sm:p-10">
            <Info aria-hidden className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 font-medium">Bileşen durumları henüz yayımlanmadı</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Bir kesinti veya bakım olduğunda bu sayfada duyurulur. Hizmetinizle ilgili bir sorun
              yaşıyorsanız{" "}
              <Link href="/musteri/panel/destek/yeni" className="font-medium text-foreground underline underline-offset-4">
                destek talebi oluşturun
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-background">
            {components.map((component) => {
              const meta = componentMeta(component.status);
              const days = buildDays(
                incidents.filter((i) => sameService(i.serviceName, component.serviceName)),
                historyDays,
                generatedAt,
                component.createdAt
              );
              return (
                <li key={component.id} className="p-5 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <h3 className="font-medium">{component.serviceName}</h3>
                      {component.description ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">{component.description}</p>
                      ) : null}
                    </div>
                    <span className="inline-flex items-center gap-2 text-sm font-medium">
                      <Dot tone={meta.tone} />
                      {meta.label}
                    </span>
                  </div>
                  <IncidentBar days={days} name={component.serviceName} />
                </li>
              );
            })}
          </ul>
        )}

        {components.length > 0 ? (
          <ul
            aria-label="Renk açıklaması"
            className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"
          >
            <li className="inline-flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-[2px] bg-emerald-500/70" />
              Kayıtlı olay yok
            </li>
            <li className="inline-flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-[2px] bg-muted ring-1 ring-border" />
              İzleme öncesi
            </li>
            {(["MINOR", "MAJOR", "CRITICAL"] as const).map((s) => (
              <li key={s} className="inline-flex items-center gap-2">
                <span aria-hidden className={cn("size-2.5 rounded-[2px]", toneDot[severityOf(s).tone])} />
                {severityOf(s).label}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section tone="muted" divider spacing="sm" aria-labelledby="bakim" containerClassName="max-w-4xl">
        <SectionHeading id="bakim" eyebrow="Bakım" title="Bakım duyuruları" className="mb-6" />
        {maintenance.length === 0 ? (
          <p className="flex items-center gap-3 rounded-xl border border-dashed bg-background p-5 text-sm text-muted-foreground">
            <Wrench aria-hidden className="size-4 shrink-0" />
            Şu anda devam eden bir bakım çalışması yok.
          </p>
        ) : (
          <ul className="space-y-3">
            {maintenance.map((c) => (
              <li key={c.id} className="flex gap-4 rounded-xl border bg-background p-5">
                <Wrench aria-hidden className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
                <div className="min-w-0">
                  <h3 className="font-medium">{c.serviceName}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {c.description || "Bu bileşende bakım çalışması sürüyor."}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Güncellendi: <time dateTime={c.updatedAt}>{formatDateTime(c.updatedAt)}</time>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section divider aria-labelledby="olay-gecmisi" containerClassName="max-w-4xl">
        <SectionHeading
          id="olay-gecmisi"
          eyebrow="Geçmiş"
          title="Olay geçmişi"
          description={`Son ${historyDays} günde çözülen olaylar.`}
          className="mb-10"
        />
        {groups.size === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center sm:p-10">
            <CheckCircle2 aria-hidden className="mx-auto size-6 text-emerald-600 dark:text-emerald-400" />
            <p className="mt-3 font-medium">Son {historyDays} günde kayıtlı olay yok</p>
          </div>
        ) : (
          <ol className="relative">
            <span
              aria-hidden
              className="absolute bottom-2 left-[5px] top-2 w-px border-l border-dashed"
            />
            {[...groups.entries()].map(([key, items]) => (
              <li key={key} className="relative pb-10 pl-8 last:pb-0">
                <span
                  aria-hidden
                  className="absolute left-0 top-1 size-[11px] rounded-full border-2 border-background bg-foreground ring-1 ring-border"
                />
                <h3 className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  <time dateTime={key}>{formatDay(items[0].startedAt)}</time>
                </h3>
                <div className="mt-4 space-y-4">
                  {items.map((incident) => (
                    <IncidentCard key={incident.id} incident={incident} nowIso={generatedAt} />
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <section className="relative overflow-hidden pb-16 md:pb-24">
        <div className="relative mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="relative grid gap-6 bg-gradient-to-br from-muted/60 to-background p-6 sm:p-10 md:grid-cols-[1fr_minmax(0,360px)] md:items-center dark:from-muted/30">
            <GridLineHorizontal className="top-0" />
            <GridLineHorizontal className="bottom-0" />
            <GridLineVertical className="left-0" />
            <GridLineVertical className="right-0" />
            <div>
              <Eyebrow className="mb-3">Bildirimler</Eyebrow>
              <h2 className="text-balance text-2xl font-semibold tracking-tight">
                Durum bildirimlerine abone olun
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Kesinti ve bakım duyurularıyla ilgili e-posta almak için adresinizi bırakın.
              </p>
            </div>
            <SubscribeForm />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
