"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ExternalLink, Eye, Pencil, Plus, ServerCog, Siren, Trash2, Wrench } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  PageHeader,
  RowActionsMenu,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  enumLabel,
  getStatusMeta,
  getStatusOptions,
  type ColumnDef,
} from "@/components/app";
import { ComponentDialogs, type ComponentDialogMode } from "@/components/admin-b/durum/component-dialogs";
import {
  EnumSelect,
  componentStatusOptions,
  durationLabel,
  severityTone,
  type ComponentRow,
  type IncidentRow,
} from "@/components/admin-b/durum/shared";
import { updateStatusComponent } from "@/lib/actions/admin/system-status";
import { formatDateTime } from "@/lib/format/date";
import { toast } from "@/lib/toast";

const HISTORY_DAYS = 90;
const detailHref = (id: string) => `/yonetim/durum/olaylar/${id}`;
const newIncidentHref = (component?: string) =>
  component ? `/yonetim/durum/olaylar/yeni?bilesen=${encodeURIComponent(component)}` : "/yonetim/durum/olaylar/yeni";

function SeverityBadge({ severity }: { severity: string }) {
  return <StatusBadge tone={severityTone(severity)} label={`${enumLabel("incidentSeverity", severity)} etki`} />;
}

function overall(components: ComponentRow[], open: IncidentRow[]) {
  const s = components.map((c) => c.status);
  if (s.includes("MAJOR_OUTAGE") || open.some((i) => i.severity === "CRITICAL"))
    return { value: "Büyük kesinti", tone: "danger" as const };
  if (s.includes("PARTIAL_OUTAGE") || s.includes("DEGRADED") || open.length)
    return { value: "Kısmi sorun", tone: "warning" as const };
  if (s.includes("MAINTENANCE")) return { value: "Bakım var", tone: "info" as const };
  return { value: "Sorun yok", tone: "success" as const };
}

const incidentColumns: ColumnDef<IncidentRow>[] = [
  {
    accessorKey: "title",
    header: "Olay",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[360px]">
        <Link href={detailHref(row.original.id)} className="font-medium hover:underline">
          {row.original.title}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{row.original.serviceName}</p>
      </div>
    ),
  },
  {
    accessorKey: "severity",
    header: "Etki",
    enableSorting: false,
    cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="incident" status={row.original.status} />,
  },
  {
    id: "startedAt",
    accessorFn: (r) => r.startedAt,
    header: "Başlangıç",
    cell: ({ row }) => <span className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateTime(row.original.startedAt)}</span>,
  },
  {
    id: "duration",
    header: "Süre",
    enableSorting: false,
    meta: { align: "right" },
    cell: ({ row }) =>
      row.original.resolvedAt ? (
        <span className="whitespace-nowrap tabular-nums">{durationLabel(row.original.startedAt, row.original.resolvedAt)}</span>
      ) : (
        <span className="text-muted-foreground">Sürüyor</span>
      ),
  },
];

export function DurumYonetimContent({
  components,
  incidents,
  generatedAt,
}: {
  components: ComponentRow[];
  incidents: IncidentRow[];
  generatedAt: string;
}) {
  const [dialog, setDialog] = useState<ComponentDialogMode>(null);
  const open = incidents.filter((i) => i.status !== "RESOLVED");
  const since = Date.parse(generatedAt) - HISTORY_DAYS * 86_400_000;
  const resolvedRecent = incidents.filter(
    (i) => i.status === "RESOLVED" && Date.parse(i.resolvedAt ?? i.startedAt) >= since
  ).length;
  const affected = components.filter((c) => c.status !== "OPERATIONAL").length;
  const state = overall(components, open);

  return (
    <>
      <PageHeader
        title="Sistem durumu"
        description="Herkese açık durum sayfasındaki bileşenleri, olayları ve bakım duyurularını yönetin. Değişiklikler anında yayımlanır."
        actions={
          <>
            <a href="/musteri/durum" target="_blank" rel="noopener noreferrer" className={appButton({ variant: "outline" })}>
              <ExternalLink aria-hidden />
              Durum sayfası
            </a>
            <Link href={newIncidentHref()} className={appButton()}>
              <Siren aria-hidden />
              Olay bildir
            </Link>
          </>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Genel durum" value={state.value} tone={state.tone} hint="Durum sayfasındaki özet" />
        <StatCard
          label="Bileşenler"
          value={components.length}
          hint={components.length ? (affected ? `${affected} bileşende sorun veya bakım` : "Tümü çalışıyor") : "Henüz bileşen yok"}
          tone={affected ? "warning" : undefined}
        />
        <StatCard
          label="Açık olay"
          value={open.length}
          hint={open.length ? "Çözülene kadar sayfanın üstünde görünür" : "Devam eden olay yok"}
          tone={open.length ? "danger" : undefined}
        />
        <StatCard label={`Son ${HISTORY_DAYS} gün`} value={resolvedRecent} hint="Çözülen olay" />
      </StatGrid>

      {open.length ? (
        <SectionCard title="Devam eden olaylar" description="Her gelişmede zaman çizelgesine güncelleme ekleyin." flush>
          <ul className="divide-y">
            {open.map((i) => {
              const last = [...i.updates].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
              return (
                <li key={i.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:justify-between md:px-5">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge kind="incident" status={i.status} />
                      <SeverityBadge severity={i.severity} />
                      <span className="text-xs text-muted-foreground">{i.serviceName}</span>
                    </div>
                    <h3 className="font-medium">
                      <Link href={detailHref(i.id)} className="hover:underline">
                        {i.title}
                      </Link>
                    </h3>
                    {last ? <p className="line-clamp-2 text-sm text-muted-foreground">{last.message}</p> : null}
                    <p className="text-xs tabular-nums text-muted-foreground">
                      Başladı {formatDateTime(i.startedAt)} · {durationLabel(i.startedAt, generatedAt)} sürüyor
                    </p>
                  </div>
                  <Link href={detailHref(i.id)} className={appButton({ variant: "outline", size: "sm", className: "md:shrink-0" })}>
                    <Pencil aria-hidden />
                    Güncelleme ekle
                  </Link>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Bileşenler"
        description="Durumu değiştirdiğiniz anda durum sayfası güncellenir. Sıralama ada göredir."
        flush
        actions={
          <button type="button" onClick={() => setDialog({ kind: "create" })} className={appButton({ variant: "outline", size: "sm" })}>
            <Plus aria-hidden />
            Bileşen ekle
          </button>
        }
      >
        {components.length ? (
          <ul className="divide-y">
            {components.map((c) => (
              <ComponentItem key={c.id} row={c} onDialog={setDialog} />
            ))}
          </ul>
        ) : (
          <div className="p-4 md:p-5">
            <EmptyState
              icon={ServerCog}
              title="Henüz bileşen yok"
              description="Web Hosting, DNS, E-posta gibi müşterilerin takip edeceği hizmetleri ekleyin. Durum sayfası bileşen yokken “tüm sistemler çalışıyor” gösterir."
              action={
                <button type="button" onClick={() => setDialog({ kind: "create" })} className={appButton()}>
                  <Plus aria-hidden />
                  İlk bileşeni ekle
                </button>
              }
              compact
            />
          </div>
        )}
      </SectionCard>

      <section aria-labelledby="olay-gecmisi" className="space-y-3">
        <div className="space-y-0.5">
          <h2 id="olay-gecmisi" className="text-sm font-semibold tracking-tight">
            Olay geçmişi
          </h2>
          <p className="text-[13px] text-muted-foreground">Tüm olaylar. Çözülenler durum sayfasında {HISTORY_DAYS} gün listelenir.</p>
        </div>
        <DataTable
          caption="Olaylar"
          columns={incidentColumns}
          data={incidents}
          initialSort={[{ id: "startedAt", desc: true }]}
          searchFn={(i, q) =>
            i.title.toLocaleLowerCase("tr-TR").includes(q) || i.serviceName.toLocaleLowerCase("tr-TR").includes(q)
          }
          searchPlaceholder="Olay veya bileşen ara…"
          filters={[{ id: "status", label: "Durum", options: getStatusOptions("incident"), getValue: (i) => i.status }]}
          rowHref={(i) => detailHref(i.id)}
          rowActions={(i) => [{ label: "Görüntüle", href: detailHref(i.id), icon: <Eye aria-hidden /> }]}
          mobileCard={(i) => (
            <ListRow
              title={i.title}
              subtitle={`${i.serviceName} · ${formatDateTime(i.startedAt)}`}
              meta={
                <span className="flex flex-wrap gap-1.5">
                  <StatusBadge kind="incident" status={i.status} />
                  <SeverityBadge severity={i.severity} />
                </span>
              }
              trailing={i.resolvedAt ? durationLabel(i.startedAt, i.resolvedAt) : "Sürüyor"}
            />
          )}
          emptyState={
            <EmptyState icon={Activity} title="Kayıtlı olay yok" description="Bildirdiğiniz olaylar burada ve durum sayfasının geçmişinde listelenir." compact />
          }
        />
      </section>

      <ComponentDialogs mode={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

function ComponentItem({ row, onDialog }: { row: ComponentRow; onDialog: (m: ComponentDialogMode) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState(row.status);

  const change = (next: string) => {
    const prev = status;
    setStatus(next);
    start(async () => {
      const res = await updateStatusComponent(row.id, {
        serviceName: row.serviceName,
        description: row.description,
        status: next as "OPERATIONAL",
      });
      if (!res.success) {
        setStatus(prev);
        toast.error(res.error);
        return;
      }
      toast.success(`${row.serviceName}: ${getStatusMeta("systemStatus", next).label}`);
      router.refresh();
    });
  };

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 md:px-5">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{row.serviceName}</h3>
          {row.openIncidents ? (
            <StatusBadge tone="danger" label={`${row.openIncidents} açık olay`} size="sm" />
          ) : null}
        </div>
        {row.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{row.description}</p> : null}
        <p className="text-xs tabular-nums text-muted-foreground">Güncellendi {formatDateTime(row.updatedAt)}</p>
      </div>
      <div className="flex items-center gap-2">
        <EnumSelect
          value={status}
          onChange={change}
          options={componentStatusOptions()}
          withDots
          kind="systemStatus"
          ariaLabel={`${row.serviceName} durumu`}
          className="w-full sm:w-[190px]"
        />
        <span aria-live="polite" className="sr-only">
          {pending ? "Kaydediliyor" : ""}
        </span>
        <RowActionsMenu
          label={`${row.serviceName} işlemleri`}
          actions={[
            { label: "Düzenle", icon: <Pencil aria-hidden />, onSelect: () => onDialog({ kind: "edit", row }) },
            { label: "Bakım duyur", icon: <Wrench aria-hidden />, onSelect: () => onDialog({ kind: "maintenance", row }) },
            { label: "Olay bildir", icon: <Siren aria-hidden />, href: newIncidentHref(row.serviceName) },
            { label: "Sil", icon: <Trash2 aria-hidden />, destructive: true, separator: true, onSelect: () => onDialog({ kind: "delete", row }) },
          ]}
        />
      </div>
    </li>
  );
}
