"use client";

import Link from "next/link";
import { ClipboardCheck, Wrench } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  type ColumnDef,
} from "@/components/app";
import { LinkTabs } from "@/components/admin-b/icerik/link-tabs";
import { formatDateTime } from "@/lib/format/date";
import { SLA_LABELS, formatWaiting, slaState } from "@/lib/provisioning/sla";

export interface ManualTaskRow {
  id: string;
  status: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  categoryName: string;
  domain: string | null;
  customerId: string;
  customerName: string;
  createdAt: string;
  completedAt: string | null;
  waitingMs: number;
}

interface Props {
  tab: "PENDING" | "COMPLETED";
  counts: { pending: number; completed: number };
  slaHours: number;
  tasks: ManualTaskRow[];
}

function SlaBadge({ task, slaHours }: { task: ManualTaskRow; slaHours: number }) {
  const state = SLA_LABELS[slaState(task.waitingMs, slaHours)];
  return (
    <div className="space-y-0.5">
      <p className="whitespace-nowrap font-mono text-[13px] tabular-nums">{formatWaiting(task.waitingMs)}</p>
      <StatusBadge tone={state.tone} label={task.completedAt ? `Teslim: ${state.label.toLocaleLowerCase("tr-TR")}` : state.label} />
    </div>
  );
}

export function KurulumlarContent({ tab, counts, slaHours, tasks }: Props) {
  const breached = tasks.filter((task) => !task.completedAt && slaState(task.waitingMs, slaHours) === "breached").length;
  const taskHref = (task: ManualTaskRow) => `/yonetim/kurulumlar/${task.id}`;

  const columns: ColumnDef<ManualTaskRow>[] = [
    {
      id: "order",
      accessorFn: (task) => new Date(task.createdAt).getTime(),
      header: "Sipariş",
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link href={taskHref(row.original)} className="font-mono text-[13px] font-medium hover:underline">
            {row.original.orderNumber}
          </Link>
          <p className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">Ödendi {formatDateTime(row.original.createdAt)}</p>
        </div>
      ),
    },
    {
      id: "customer",
      accessorFn: (task) => task.customerName,
      header: "Müşteri",
      cell: ({ row }) => (
        <Link href={`/yonetim/musteriler/${row.original.customerId}`} className="block max-w-[200px] truncate hover:underline">
          {row.original.customerName}
        </Link>
      ),
    },
    {
      id: "product",
      accessorFn: (task) => task.productName,
      header: "Ürün",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p>{row.original.productName}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.categoryName}
            {row.original.domain ? ` · ${row.original.domain}` : ""}
          </p>
        </div>
      ),
    },
    {
      id: "waiting",
      accessorFn: (task) => task.waitingMs,
      header: tab === "COMPLETED" ? "Teslim süresi" : "Bekleme",
      cell: ({ row }) => <SlaBadge task={row.original} slaHours={slaHours} />,
    },
    {
      id: "action",
      header: () => <span className="sr-only">İşlem</span>,
      enableSorting: false,
      meta: { align: "right", className: "w-px" },
      cell: ({ row }) => (
        <Link href={taskHref(row.original)} className={appButton({ variant: row.original.completedAt ? "ghost" : "primary", size: "sm" })}>
          {row.original.completedAt ? "Görüntüle" : "Kurulumu aç"}
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Kurulum görevleri"
        description={`Otomatik kurulum modülü olmayan ürünlerin (Faz 1'de VDS) ödenmiş siparişleri. Teslim bilgilerini girip aktifleştirdiğinizde müşteriye "hizmet aktif" e-postası gider. Hedef süre: ${slaHours} saat.`}
      />

      <StatGrid columns={3}>
        <StatCard label="Bekleyen" value={counts.pending.toLocaleString("tr-TR")} tone={counts.pending ? "warning" : undefined} hint="Kurulum bekliyor" />
        <StatCard label="Süresi aşılan" value={breached.toLocaleString("tr-TR")} tone={breached ? "danger" : undefined} hint={`${slaHours} saatten uzun bekleyen`} />
        <StatCard label="Tamamlanan" value={counts.completed.toLocaleString("tr-TR")} tone={counts.completed ? "success" : undefined} hint="Teslim edildi" />
      </StatGrid>

      <div className="space-y-3">
        <LinkTabs
          label="Durum filtresi"
          active={tab}
          tabs={[
            { value: "PENDING", label: "Bekleyen", href: "/yonetim/kurulumlar", count: counts.pending },
            { value: "COMPLETED", label: "Tamamlanan", href: "/yonetim/kurulumlar?status=COMPLETED", count: counts.completed },
          ]}
        />
        <DataTable
          caption="Kurulum görevleri"
          columns={columns}
          data={tasks}
          getRowId={(task) => task.id}
          rowHref={taskHref}
          initialSort={[{ id: "order", desc: tab === "COMPLETED" }]}
          searchFn={(task, q) =>
            task.orderNumber.toLocaleLowerCase("tr-TR").includes(q) ||
            task.customerName.toLocaleLowerCase("tr-TR").includes(q) ||
            task.productName.toLocaleLowerCase("tr-TR").includes(q)
          }
          searchPlaceholder="Sipariş, müşteri, ürün ara…"
          mobileCard={(task) => (
            <ListRow
              title={<span className="font-mono">{task.orderNumber}</span>}
              subtitle={`${task.customerName} · ${task.productName}`}
              trailing={<span className="font-mono text-xs">{formatWaiting(task.waitingMs)}</span>}
              meta={<StatusBadge {...SLA_LABELS[slaState(task.waitingMs, slaHours)]} />}
            />
          )}
          emptyState={
            <EmptyState
              icon={tab === "COMPLETED" ? ClipboardCheck : Wrench}
              title={tab === "COMPLETED" ? "Tamamlanan kurulum yok" : "Bekleyen kurulum yok"}
              description={tab === "COMPLETED" ? undefined : "Ödemesi alınan manuel ürünler burada görünür."}
            />
          }
        />
      </div>
    </>
  );
}
