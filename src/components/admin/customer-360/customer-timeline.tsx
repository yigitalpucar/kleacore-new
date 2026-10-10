import Link from "next/link";
import { ArrowRight, History, RotateCcw } from "lucide-react";
import { EmptyState, SectionCard, StatusBadge, ToneDot, appButton, type StatusKind } from "@/components/app";
import {
  TIMELINE_KIND_LABELS,
  encodeCursor,
  type TimelineCursor,
  type TimelineEvent,
  type TimelineKind,
} from "@/lib/admin/customer-timeline";
import { formatDateLong } from "@/lib/format/date";
import { formatTRY } from "@/lib/format/price";
import { cn } from "@/lib/utils";

const timeFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * Customer 360 timeline (server component): kind filter chips, events
 * grouped by Istanbul day, cursor pagination via links (no client state).
 */
export function CustomerTimeline({
  basePath,
  allowed,
  active,
  events,
  next,
  paged,
}: {
  /** Customer page path, e.g. /yonetim/musteriler/abc. */
  basePath: string;
  allowed: TimelineKind[];
  active: TimelineKind[];
  events: TimelineEvent[];
  next: TimelineCursor | null;
  /** True when showing an older page (shows "back to newest"). */
  paged: boolean;
}) {
  const all = active.length === allowed.length;
  const href = (kinds: TimelineKind[], cursor?: TimelineCursor | null) => {
    const sp = new URLSearchParams();
    if (kinds.length && kinds.length !== allowed.length) sp.set("tur", kinds.join(","));
    if (cursor) sp.set("once", encodeCursor(cursor));
    const qs = sp.toString();
    return `${basePath}${qs ? `?${qs}` : ""}#zaman-cizelgesi`;
  };
  const toggle = (kind: TimelineKind) => {
    if (all) return [kind];
    const set = new Set(active);
    if (set.has(kind)) set.delete(kind);
    else set.add(kind);
    return set.size ? allowed.filter((k) => set.has(k)) : allowed;
  };

  const groups: { day: string; label: string; items: TimelineEvent[] }[] = [];
  for (const e of events) {
    const day = dayKeyFmt.format(e.at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(e);
    else groups.push({ day, label: formatDateLong(e.at), items: [e] });
  }

  return (
    <SectionCard
      id="zaman-cizelgesi"
      title="Zaman çizelgesi"
      description="Siparişler, faturalar, ödemeler, talepler, girişler ve kayıtlar tek akışta"
      flush
      actions={
        paged ? (
          <Link href={href(active)} scroll={false} className={appButton({ variant: "ghost", size: "sm" })}>
            <RotateCcw aria-hidden />
            En yeniye dön
          </Link>
        ) : undefined
      }
    >
      <nav aria-label="Zaman çizelgesi filtresi" className="-mx-1 flex gap-1 overflow-x-auto border-b px-4 py-3 [scrollbar-width:none] md:px-5">
        <Link
          href={href(allowed)}
          scroll={false}
          aria-current={all ? "true" : undefined}
          className={chip(all)}
        >
          Tümü
        </Link>
        {allowed.map((kind) => {
          const on = !all && active.includes(kind);
          return (
            <Link key={kind} href={href(toggle(kind))} scroll={false} aria-current={on ? "true" : undefined} className={chip(on)}>
              {TIMELINE_KIND_LABELS[kind]}
            </Link>
          );
        })}
      </nav>

      {events.length === 0 ? (
        <div className="p-4 md:p-5">
          <EmptyState compact icon={History} title="Kayıt yok" description="Seçili türlerde bu müşteriye ait kayıt bulunmuyor." />
        </div>
      ) : (
        <div className="px-4 py-4 md:px-5">
          {groups.map((group) => (
            <section key={group.day} aria-label={group.label} className="mb-4 last:mb-0">
              <h3 className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{group.label}</h3>
              <ol className="relative space-y-1">
                <span aria-hidden className="absolute bottom-3 left-[3px] top-3 w-px border-l border-dashed" />
                {group.items.map((e) => (
                  <li key={e.key} className="relative flex gap-3">
                    <span aria-hidden className="relative z-[1] mt-[15px] flex size-[7px] shrink-0 rounded-full bg-foreground ring-4 ring-card" />
                    <EventBody event={e} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {next ? (
        <div className="border-t px-4 py-3 md:px-5">
          <Link href={href(active, next)} scroll={false} className={appButton({ variant: "outline", size: "sm" })}>
            Daha eski kayıtlar
            <ArrowRight aria-hidden />
          </Link>
        </div>
      ) : null}
    </SectionCard>
  );
}

function chip(active: boolean) {
  return cn(
    "inline-flex h-10 shrink-0 items-center rounded-md border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8 md:px-2.5",
    active ? "border-foreground bg-foreground text-background" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
  );
}

function EventBody({ event: e }: { event: TimelineEvent }) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium">{e.title}</span>
          {e.status ? (
            <StatusBadge kind={e.status.kind as StatusKind} audience="admin" status={e.status.value} size="sm" />
          ) : e.tone ? (
            <ToneDot tone={e.tone} />
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          <span className="font-mono uppercase tracking-wider">{TIMELINE_KIND_LABELS[e.kind]}</span>
          {e.detail ? ` · ${e.detail}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {e.amount != null ? <p className="text-sm font-medium tabular-nums">{formatTRY(e.amount, { keepDecimals: true })}</p> : null}
        <time dateTime={e.at.toISOString()} className="text-xs tabular-nums text-muted-foreground">
          {timeFmt.format(e.at)}
        </time>
      </div>
    </>
  );
  const cls = "flex min-w-0 flex-1 items-start gap-3 rounded-md px-2 py-2";
  return e.href ? (
    <Link
      href={e.href}
      prefetch={false}
      className={cn(cls, "-mx-2 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
    >
      {inner}
    </Link>
  ) : (
    <div className={cn(cls, "-mx-2")}>{inner}</div>
  );
}
