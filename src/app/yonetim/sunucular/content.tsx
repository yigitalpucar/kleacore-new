"use client";

import Link from "next/link";
import { Activity, Eye, Plus, Power, RefreshCcw, Server, Wrench } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DataTable,
  EmptyState,
  IconTile,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  UnavailableAction,
  type ColumnDef,
} from "@/components/app";
import {
  ServerUsageCell,
  getServerStatus,
  serverStatusMeta,
  serverStatusOptions,
  type ServerStatus,
} from "@/components/admin-b/sunucular/server-status";

interface ServerData {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  location: string;
  provider: string;
  cpuModel: string | null;
  cpuCores: number;
  ramTotal: number;
  diskTotal: number;
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  isActive: boolean;
  isOnline: boolean;
  uptime: number;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SunucularContentProps {
  servers: ServerData[];
}

type Row = ServerData & { status: ServerStatus };

const detailHref = (id: string) => `/yonetim/sunucular/${id}`;
const pct = (n: number) => `%${n.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: "name",
    header: "Sunucu",
    cell: ({ row }) => {
      const s = row.original;
      return (
        <div className="flex min-w-0 items-center gap-3">
          <IconTile size="sm">
            <Server />
          </IconTile>
          <div className="min-w-0">
            <Link href={detailHref(s.id)} className="font-medium hover:underline">
              {s.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{s.hostname}</p>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "ipAddress",
    header: "IP / Konum",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="font-mono text-[13px]">{row.original.ipAddress}</p>
        <p className="truncate text-xs text-muted-foreground">
          {row.original.location} · {row.original.provider}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge {...serverStatusMeta[row.original.status]} />,
  },
  {
    accessorKey: "cpuUsage",
    header: "CPU",
    cell: ({ row }) => (
      <ServerUsageCell value={row.original.cpuUsage} hidden={row.original.status === "maintenance" || row.original.status === "offline"} />
    ),
  },
  {
    accessorKey: "ramUsage",
    header: "RAM",
    cell: ({ row }) => (
      <ServerUsageCell value={row.original.ramUsage} hidden={row.original.status === "maintenance" || row.original.status === "offline"} />
    ),
  },
  {
    accessorKey: "diskUsage",
    header: "Disk",
    cell: ({ row }) => <ServerUsageCell value={row.original.diskUsage} />,
  },
  {
    accessorKey: "uptime",
    header: "Uptime",
    meta: { align: "right" },
    cell: ({ row }) => <span className="tabular-nums">{pct(row.original.uptime)}</span>,
  },
];

export function SunucularContent({ servers }: SunucularContentProps) {
  const rows: Row[] = servers.map((s) => ({ ...s, status: getServerStatus(s) }));

  const onlineCount = rows.filter((s) => s.status === "online").length;
  const warningCount = rows.filter((s) => s.status === "warning").length;
  const offlineCount = rows.filter((s) => s.status === "offline").length;
  const avgUptime = servers.length > 0 ? servers.reduce((sum, s) => sum + s.uptime, 0) / servers.length : null;

  return (
    <TooltipProvider delayDuration={200}>
      <PageHeader
        title="Sunucular"
        description="Sunucu durumlarını, kaynak kullanımını ve çalışma sürelerini izleyin."
        actions={<UnavailableAction label="Sunucu ekle" icon={<Plus aria-hidden />} variant="primary" />}
      />

      <StatGrid columns={4}>
        <StatCard label="Toplam sunucu" value={servers.length.toLocaleString("tr-TR")} icon={Server} />
        <StatCard
          label="Çevrimiçi"
          value={onlineCount.toLocaleString("tr-TR")}
          hint={servers.length > 0 ? `${pct(Math.round((onlineCount / servers.length) * 100))} sağlıklı` : "Sunucu yok"}
          tone={servers.length > 0 && onlineCount === servers.length ? "success" : undefined}
        />
        <StatCard
          label="Uyarı / çevrimdışı"
          value={`${warningCount} / ${offlineCount}`}
          hint="CPU veya RAM %90 üzeri ya da yanıt yok"
          tone={offlineCount > 0 ? "danger" : warningCount > 0 ? "warning" : undefined}
        />
        <StatCard
          label="Ort. uptime"
          value={avgUptime === null ? "—" : pct(Number(avgUptime.toFixed(2)))}
          icon={Activity}
          hint="Kayıtlı uptime değerlerinin ortalaması"
        />
      </StatGrid>

      <DataTable
        caption="Sunucular"
        columns={columns}
        data={rows}
        initialSort={[{ id: "name", desc: false }]}
        searchFn={(s, q) =>
          s.name.toLocaleLowerCase("tr-TR").includes(q) ||
          s.hostname.toLocaleLowerCase("tr-TR").includes(q) ||
          s.ipAddress.includes(q)
        }
        searchPlaceholder="Sunucu adı, hostname veya IP ara…"
        filters={[
          {
            id: "status",
            label: "Durum",
            options: serverStatusOptions,
            getValue: (s) => s.status,
          },
        ]}
        rowHref={(s) => detailHref(s.id)}
        rowActions={(s) => [
          { label: "Detayları gör", href: detailHref(s.id), icon: <Eye aria-hidden /> },
          { label: "Yeniden başlat", icon: <RefreshCcw aria-hidden />, disabledReason: "Yakında" },
          { label: "Bakım modu", icon: <Wrench aria-hidden />, disabledReason: "Yakında", separator: true },
          { label: "Kapat", icon: <Power aria-hidden />, disabledReason: "Yakında", destructive: true },
        ]}
        mobileCard={(s) => (
          <ListRow
            title={s.name}
            subtitle={`${s.ipAddress} · ${s.location}`}
            trailing={<span className="text-xs text-muted-foreground">{pct(s.uptime)}</span>}
            meta={
              <>
                <StatusBadge {...serverStatusMeta[s.status]} />
                {s.status === "online" || s.status === "warning" ? (
                  <>
                    <span className="tabular-nums">CPU {pct(s.cpuUsage)}</span>
                    <span className="tabular-nums">RAM {pct(s.ramUsage)}</span>
                  </>
                ) : null}
                <span className="tabular-nums">Disk {pct(s.diskUsage)}</span>
              </>
            }
          />
        )}
        emptyState={
          <EmptyState
            icon={Server}
            title="Henüz sunucu eklenmemiş"
            description="Sunucu kayıtları eklendiğinde durumları ve kaynak kullanımları burada listelenir."
          />
        }
      />
    </TooltipProvider>
  );
}
