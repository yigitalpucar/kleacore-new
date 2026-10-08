"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, Cloud, HardDrive, Loader2, Play, Plus, Power, RotateCcw, Server, Settings, Terminal } from "lucide-react";
import {
  CopyButton,
  DataTable,
  EmptyState,
  IconTile,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  UnavailableAction,
  appButton,
  getStatusOptions,
  type ColumnDef,
  type RowAction,
} from "@/components/app";
import { formatDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { restartServer, stopServer, startServer } from "@/lib/actions/customer/servers";
import { CUSTOMER_STOPPED_REASON, customerStartBlockReason } from "@/lib/services/server-power";
import { toast } from "@/lib/toast";

interface ServerServiceItem {
  id: string;
  label: string;
  productName: string;
  categorySlug: string;
  domain: string | null;
  ipAddress: string | null;
  status: string;
  suspendReason: string | null;
  /** Bound to an automation module (Proxmox): reinstall etc. live on the detail page. */
  managed: boolean;
  cpuUsage: number;
  ramUsage: number;
  diskUsed: number;
  diskLimit: number;
  createdAt: string;
  expiresAt: string | null;
}

interface SunucularContentProps {
  servers: ServerServiceItem[];
  stats: {
    total: number;
    active: number;
    suspended: number;
  };
}

const SERVICE_PATH = "/musteri/panel/hizmetlerim";
const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

function ServerIcon({ slug }: { slug: string }) {
  return <IconTile size="sm">{slug === "cloud" ? <Cloud /> : <Server />}</IconTile>;
}

function hasUsage(s: ServerServiceItem) {
  return s.status === "ACTIVE" && (s.cpuUsage > 0 || s.ramUsage > 0 || s.diskLimit > 0);
}

/** Compact usage bar: monochrome fill, amber ≥70 %, red ≥90 % (same thresholds as UsageMeter). */
function MiniMeter({ label, percent, value }: { label: string; percent: number; value: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const fill = clamped >= 90 ? "bg-red-500" : clamped >= 70 ? "bg-amber-500" : "bg-foreground";
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="whitespace-nowrap tabular-nums">{value}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        className="h-1 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full", fill)} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function UsageCell({ s }: { s: ServerServiceItem }) {
  if (!hasUsage(s)) return <span className="text-xs text-muted-foreground">—</span>;
  const diskPct = s.diskLimit > 0 ? (s.diskUsed / s.diskLimit) * 100 : 0;
  return (
    <div className="grid w-full min-w-[300px] max-w-[360px] grid-cols-3 gap-3">
      <MiniMeter label="CPU" percent={s.cpuUsage} value={`%${Math.round(s.cpuUsage)}`} />
      <MiniMeter label="RAM" percent={s.ramUsage} value={`%${Math.round(s.ramUsage)}`} />
      <MiniMeter
        label="Disk"
        percent={diskPct}
        value={s.diskLimit > 0 ? `${fmt(s.diskUsed)}/${fmt(s.diskLimit)} GB` : `${fmt(s.diskUsed)} GB`}
      />
    </div>
  );
}

export function SunucularContent({ servers, stats }: SunucularContentProps) {
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [localServers, setLocalServers] = useState(servers);

  const handleRestart = async (serviceId: string) => {
    setActionInProgress(serviceId);
    const result = await restartServer(serviceId);
    if (result.success) {
      toast.success("Sunucu yeniden başlatıldı");
    } else {
      toast.error(result.error || "İşlem başarısız");
    }
    setActionInProgress(null);
  };

  const handleStop = async (serviceId: string) => {
    if (!window.confirm("Sunucu durdurulacak. Üzerindeki tüm uygulamalar erişilemez olur. Devam edilsin mi?")) return;
    setActionInProgress(serviceId);
    const result = await stopServer(serviceId);
    if (result.success) {
      setLocalServers((prev) => prev.map((s) => (s.id === serviceId ? { ...s, status: "SUSPENDED", suspendReason: CUSTOMER_STOPPED_REASON } : s)));
      toast.success("Sunucu durduruldu");
    } else {
      toast.error(result.error || "İşlem başarısız");
    }
    setActionInProgress(null);
  };

  const handleStart = async (serviceId: string) => {
    setActionInProgress(serviceId);
    const result = await startServer(serviceId);
    if (result.success) {
      setLocalServers((prev) => prev.map((s) => (s.id === serviceId ? { ...s, status: "ACTIVE", suspendReason: null } : s)));
      toast.success("Sunucu başlatıldı");
    } else {
      toast.error(result.error || "İşlem başarısız");
    }
    setActionInProgress(null);
  };

  const rowActions = (s: ServerServiceItem): RowAction[] => {
    const isActive = s.status === "ACTIVE";
    const busy = actionInProgress === s.id ? "İşlem sürüyor" : undefined;
    return [
      { label: "Hizmeti yönet", href: `${SERVICE_PATH}/${s.id}`, icon: <Settings aria-hidden /> },
      {
        label: "Yeniden başlat",
        icon: <RotateCcw aria-hidden />,
        onSelect: () => void handleRestart(s.id),
        disabledReason: busy ?? (isActive ? undefined : "Sunucu çalışmıyor"),
        separator: true,
      },
      isActive
        ? { label: "Durdur", icon: <Power aria-hidden />, onSelect: () => void handleStop(s.id), disabledReason: busy, destructive: true }
        : {
            label: "Başlat",
            icon: <Play aria-hidden />,
            onSelect: () => void handleStart(s.id),
            disabledReason: busy ?? customerStartBlockReason(s) ?? undefined,
          },
      { label: "Snapshot al", icon: <Camera aria-hidden />, disabledReason: "Yakında", separator: true },
      s.managed
        ? { label: "İşletim sistemini yeniden kur", icon: <HardDrive aria-hidden />, href: `${SERVICE_PATH}/${s.id}` }
        : { label: "İşletim sistemini yeniden kur", icon: <HardDrive aria-hidden />, disabledReason: "Yakında" },
    ];
  };

  const PrimaryAction = ({ s }: { s: ServerServiceItem }) => {
    const busy = actionInProgress === s.id;
    if (s.status === "ACTIVE") {
      return <UnavailableAction label="Konsol" icon={<Terminal aria-hidden />} size="sm" />;
    }
    const blockReason = customerStartBlockReason(s);
    return (
      <button
        type="button"
        className={appButton({ variant: "outline", size: "sm" })}
        disabled={busy || Boolean(blockReason)}
        title={blockReason ?? undefined}
        onClick={() => void handleStart(s.id)}
      >
        {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Play aria-hidden />}
        Başlat
      </button>
    );
  };

  const columns: ColumnDef<ServerServiceItem>[] = [
    {
      id: "name",
      accessorFn: (s) => s.label || s.productName,
      header: "Sunucu",
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <ServerIcon slug={s.categorySlug} />
            <div className="min-w-0">
              <Link href={`${SERVICE_PATH}/${s.id}`} className="font-medium hover:underline">
                {s.label || s.productName}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {s.productName}
                <span className="font-mono"> · {s.categorySlug.toLocaleUpperCase("tr-TR")}</span>
              </p>
            </div>
          </div>
        );
      },
    },
    {
      id: "ip",
      accessorFn: (s) => s.ipAddress ?? "",
      header: "IP adresi",
      cell: ({ row }) =>
        row.original.ipAddress ? (
          <span className="inline-flex items-center gap-1 font-mono text-[13px]">
            {row.original.ipAddress}
            <CopyButton value={row.original.ipAddress} label="IP adresini kopyala" />
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "usage",
      header: "Kaynak kullanımı",
      enableSorting: false,
      cell: ({ row }) => <UsageCell s={row.original} />,
    },
    {
      accessorKey: "status",
      header: "Durum",
      enableSorting: false,
      cell: ({ row }) => <StatusBadge kind="service" status={row.original.status} />,
    },
    {
      id: "primary",
      header: () => <span className="sr-only">İşlem</span>,
      enableSorting: false,
      meta: { align: "right", className: "w-px" },
      cell: ({ row }) => <PrimaryAction s={row.original} />,
    },
  ];

  const newServer = (
    <Link href="/sunucu/vds" className={appButton()}>
      <Plus aria-hidden />
      Yeni sunucu
    </Link>
  );

  return (
    <>
      <PageHeader title="Sunucularım" description="VDS, VPS ve bulut sunucularınızı izleyin ve yönetin." actions={newServer} />

      <StatGrid columns={3} className="grid-cols-1 sm:grid-cols-3">
        <StatCard label="Toplam" value={stats.total} hint="Tüm sunucularınız" />
        <StatCard
          label="Aktif"
          value={stats.active}
          tone={stats.active ? "success" : undefined}
          hint={stats.active ? "Çalışan sunucular" : "Çalışan sunucu yok"}
        />
        <StatCard
          label="Durdurulan / askıda"
          value={stats.suspended}
          tone={stats.suspended ? "warning" : undefined}
          hint={stats.suspended ? "Durdurulan veya askıya alınan sunucular" : "Durdurulan sunucu yok"}
        />
      </StatGrid>

      <DataTable
        caption="Sunucular"
        columns={columns}
        data={localServers}
        getRowId={(s) => s.id}
        searchFn={(s, q) =>
          s.label.toLocaleLowerCase("tr-TR").includes(q) ||
          s.productName.toLocaleLowerCase("tr-TR").includes(q) ||
          (s.ipAddress || "").includes(q)
        }
        searchPlaceholder="Sunucu adı veya IP ara…"
        filters={
          localServers.length > 1
            ? [
                {
                  id: "status",
                  label: "Durum",
                  options: getStatusOptions("service").filter((o) => localServers.some((s) => s.status === o.value)),
                  getValue: (s) => s.status,
                },
              ]
            : undefined
        }
        rowActions={rowActions}
        mobileCard={(s) => {
          const diskPct = s.diskLimit > 0 ? (s.diskUsed / s.diskLimit) * 100 : 0;
          return (
            <div className="space-y-3">
              <ListRow
                leading={<ServerIcon slug={s.categorySlug} />}
                title={s.label || s.productName}
                subtitle={
                  <span>
                    {s.productName}
                    {s.ipAddress ? <span className="font-mono"> · {s.ipAddress}</span> : null}
                  </span>
                }
                trailing={<StatusBadge kind="service" status={s.status} />}
                meta={s.expiresAt ? <span>Bitiş {formatDate(s.expiresAt)}</span> : undefined}
              />
              {hasUsage(s) ? (
                <div className="grid grid-cols-3 gap-3 pl-11">
                  <MiniMeter label="CPU" percent={s.cpuUsage} value={`%${Math.round(s.cpuUsage)}`} />
                  <MiniMeter label="RAM" percent={s.ramUsage} value={`%${Math.round(s.ramUsage)}`} />
                  <MiniMeter label="Disk" percent={diskPct} value={`${fmt(s.diskUsed)} GB`} />
                </div>
              ) : null}
              <div className="flex items-center gap-2 pl-11">
                <PrimaryAction s={s} />
                <Link href={`${SERVICE_PATH}/${s.id}`} className={appButton({ variant: "ghost", size: "sm" })}>
                  Yönet
                </Link>
              </div>
            </div>
          );
        }}
        emptyState={
          <EmptyState
            icon={Server}
            title="Henüz sunucunuz yok"
            description="VDS veya VPS paketlerinden birini seçerek dakikalar içinde sunucunuzu açabilirsiniz."
            action={
              <Link href="/sunucu/vds" className={appButton()}>
                Sunucu paketlerini incele
              </Link>
            }
          />
        }
        noResultsText="Aramanızla eşleşen sunucu bulunamadı."
      />
    </>
  );
}

