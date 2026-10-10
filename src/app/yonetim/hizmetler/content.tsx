"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Eye, FileText, Package, Pause, Pencil, Plus, XCircle } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  enumLabel,
  getStatusOptions,
  type ColumnDef,
  type RowAction,
} from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import { activateService, cancelService, suspendService } from "@/lib/actions/admin/services";
import { bulkSuspendServices, bulkUnsuspendServices } from "@/lib/actions/admin/bulk";
import { useAdminList, type BulkActionDef } from "@/components/admin/list-tools/use-admin-list";
import type { ListCapabilities } from "@/lib/admin/list-views";
import { formatTRY } from "@/lib/format/price";
import { billingPeriodLabel, billingPeriodUnit, formatDate } from "@/lib/format/date";
import { toast } from "@/lib/toast";
import { SERVICE_FILTER_VALUES, serviceSearch, type ServiceListRow } from "./service-rows";

export type { ServiceListRow } from "./service-rows";

type ServiceStats = {
  total: number;
  active: number;
  suspended: number;
  cancelled: number;
  expired: number;
};

type ServicesContentProps = {
  rows: ServiceListRow[];
  stats: ServiceStats;
  pagination: { page: number; totalPages: number; total: number };
  /** Status pages (aktif / askida / iptal) lock the list to one status. */
  view: { title: string; description: string; status?: string };
  /** Bulk actions / CSV export allowed for the viewer (from the server). */
  capabilities?: ListCapabilities;
};

const n = (v: number) => v.toLocaleString("tr-TR");

const BULK_ACTIONS: BulkActionDef<ServiceListRow>[] = [
  {
    id: "suspend",
    label: "Askıya al",
    icon: <Pause aria-hidden />,
    appliesTo: (s) => s.status === "ACTIVE",
    confirmTitle: (c) => `${n(c)} hizmet askıya alınsın mı?`,
    confirmDescription: "Her hizmet sağlayıcıda askıya alınır ve müşteriye bildirilir. Neden müşteri panelinde görünür.",
    input: { kind: "text", label: "Askıya alma nedeni", defaultValue: "Yönetim tarafından askıya alındı" },
    run: (ids, reason) => bulkSuspendServices(ids, reason),
    successText: (c) => `${n(c)} hizmet askıya alındı`,
  },
  {
    id: "unsuspend",
    label: "Askıdan çıkar",
    icon: <CheckCircle aria-hidden />,
    appliesTo: (s) => s.status === "SUSPENDED",
    confirmTitle: (c) => `${n(c)} hizmet yeniden açılsın mı?`,
    confirmDescription: "Her hizmet sağlayıcıda askıdan çıkarılır ve aktif olur.",
    run: (ids) => bulkUnsuspendServices(ids),
    successText: (c) => `${n(c)} hizmet aktifleştirildi`,
  },
];

const SCOPES: Record<string, string> = { ACTIVE: "active", SUSPENDED: "suspended", CANCELLED: "cancelled" };
const getId = (s: ServiceListRow) => s.id;
const getLabel = (s: ServiceListRow) => s.domain || s.label || s.product.name;

const money = (n: number) => formatTRY(n, { keepDecimals: true });
const detailHref = (id: string) => `/yonetim/hizmetler/${id}`;

function categoryLabel(row: ServiceListRow) {
  const slug = row.product.categorySlug;
  if (slug) {
    const label = enumLabel("productCategory", slug);
    if (label && label !== slug) return label;
  }
  return row.product.categoryName ?? "—";
}

function serviceTitle(row: ServiceListRow) {
  return row.domain || row.label || row.product.name;
}

function PeriodAmount({ row }: { row: ServiceListRow }) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="font-medium">{money(row.amount)}</span>
      <span className="text-xs text-muted-foreground"> / {billingPeriodUnit(row.billingPeriod)}</span>
    </span>
  );
}

export function ServicesContent({ rows, stats, pagination, view, capabilities }: ServicesContentProps) {
  const router = useRouter();
  const admin = useAdminList({
    list: "services",
    scope: view.status ? (SCOPES[view.status] ?? "all") : "all",
    filterIds: view.status ? [] : ["status"],
    getId,
    getLabel,
    noun: "hizmet",
    actions: BULK_ACTIONS,
    capabilities,
  });

  const handleSuspendService = async (serviceId: string) => {
    const reason = prompt("Askıya alma nedeni:", "Yonetim tarafindan askiya alindi")?.trim() ?? "";
    if (!reason) return;

    const result = await suspendService(serviceId, reason);
    if (!result.success) {
      toast.error(result.error ?? "Hizmet askıya alınamadı");
      return;
    }
    toast.success("Hizmet askıya alındı");
    router.refresh();
  };

  const handleActivateService = async (serviceId: string) => {
    const result = await activateService(serviceId);
    if (!result.success) {
      toast.error(result.error ?? "Hizmet aktifleştirilemedi");
      return;
    }
    toast.success("Hizmet aktifleştirildi");
    router.refresh();
  };

  const handleCancelService = async (serviceId: string) => {
    const confirmed = window.confirm("Bu hizmeti iptal etmek istediğinize emin misiniz?");
    if (!confirmed) return;

    const result = await cancelService(serviceId);
    if (!result.success) {
      toast.error(result.error ?? "Hizmet iptal edilemedi");
      return;
    }
    toast.success("Hizmet iptal edildi");
    router.refresh();
  };

  const rowActions = (s: ServiceListRow): RowAction[] => [
    { label: "Detayları görüntüle", href: detailHref(s.id), icon: <Eye aria-hidden /> },
    { label: "Düzenle", icon: <Pencil aria-hidden />, disabledReason: "Yakında" },
    { label: "Fatura oluştur", href: "/yonetim/faturalar/olustur", icon: <FileText aria-hidden /> },
    ...(s.status === "ACTIVE"
      ? [{ label: "Askıya al", icon: <Pause aria-hidden />, separator: true, onSelect: () => void handleSuspendService(s.id) }]
      : []),
    ...(s.status === "SUSPENDED"
      ? [{ label: "Aktif et", icon: <CheckCircle aria-hidden />, separator: true, onSelect: () => void handleActivateService(s.id) }]
      : []),
    ...(s.status !== "CANCELLED"
      ? [
          {
            label: "İptal et",
            icon: <XCircle aria-hidden />,
            destructive: true,
            separator: s.status !== "ACTIVE" && s.status !== "SUSPENDED",
            onSelect: () => void handleCancelService(s.id),
          },
        ]
      : []),
  ];

  const showReason = view.status === "SUSPENDED";

  const columns: ColumnDef<ServiceListRow>[] = [
    {
      id: "service",
      accessorFn: (r) => serviceTitle(r),
      header: "Hizmet",
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="min-w-0 max-w-[280px]">
            <Link href={detailHref(s.id)} className="block truncate font-medium hover:underline">
              {serviceTitle(s)}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {categoryLabel(s)} · {s.product.name}
            </p>
          </div>
        );
      },
    },
    {
      id: "customer",
      accessorFn: (r) => r.customer.name,
      header: "Müşteri",
      cell: ({ row }) => {
        const c = row.original.customer;
        return (
          <div className="min-w-0 max-w-[220px]">
            <Link href={`/yonetim/musteriler/${c.id}`} className="block truncate hover:underline">
              {c.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{c.email}</p>
          </div>
        );
      },
    },
    showReason
      ? {
          id: "reason",
          header: "Askıya alma nedeni",
          enableSorting: false,
          cell: ({ row }) => (
            <span className="line-clamp-2 max-w-[220px] text-muted-foreground">{row.original.suspendReason || "—"}</span>
          ),
        }
      : {
          id: "server",
          accessorFn: (r) => r.serverName ?? r.ipAddress ?? "",
          header: "Sunucu",
          cell: ({ row }) => {
            const s = row.original;
            if (!s.serverName && !s.ipAddress) return <span className="text-muted-foreground">—</span>;
            return (
              <div className="min-w-0">
                <p className="truncate text-[13px]">{s.serverName ?? "—"}</p>
                {s.ipAddress ? <p className="font-mono text-xs text-muted-foreground">{s.ipAddress}</p> : null}
              </div>
            );
          },
        },
    {
      accessorKey: "amount",
      header: "Tutar",
      meta: { align: "right" },
      cell: ({ row }) => (
        <div className="text-right">
          <PeriodAmount row={row.original} />
          <p className="text-xs text-muted-foreground">{billingPeriodLabel(row.original.billingPeriod)}</p>
        </div>
      ),
    },
    {
      id: "nextDueDate",
      accessorFn: (r) => r.nextDueDate ?? "",
      header: "Yenileme",
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.nextDueDate)}</span>,
    },
    {
      accessorKey: "status",
      header: "Durum",
      enableSorting: false,
      cell: ({ row }) => <StatusBadge kind="service" status={row.original.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title={view.title}
        description={view.description}
        actions={
          <Link href="/yonetim/hizmet-ekle" prefetch={false} className={appButton()}>
            <Plus aria-hidden />
            Hizmet ekle
          </Link>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Toplam hizmet" value={stats.total.toLocaleString("tr-TR")} href="/yonetim/hizmetler/tum-hizmetler" />
        <StatCard
          label="Aktif"
          value={stats.active.toLocaleString("tr-TR")}
          href="/yonetim/hizmetler/aktif"
          tone={stats.active ? "success" : undefined}
          hint="Çalışan ve faturalanan"
        />
        <StatCard
          label="Askıda"
          value={stats.suspended.toLocaleString("tr-TR")}
          href="/yonetim/hizmetler/askida"
          tone={stats.suspended ? "warning" : undefined}
          hint={stats.suspended ? "İnceleme bekliyor" : "Askıda hizmet yok"}
        />
        <StatCard
          label="İptal / süresi dolmuş"
          value={(stats.cancelled + stats.expired).toLocaleString("tr-TR")}
          href="/yonetim/hizmetler/iptal"
          hint={`${stats.cancelled.toLocaleString("tr-TR")} iptal · ${stats.expired.toLocaleString("tr-TR")} süresi dolmuş`}
        />
      </StatGrid>

      <DataTable
        caption={view.title}
        columns={columns}
        data={rows}
        initialSort={[{ id: "nextDueDate", desc: false }]}
        searchFn={serviceSearch}
        searchPlaceholder="Domain, müşteri, paket, IP veya hizmet ID ara…"
        filters={
          view.status
            ? []
            : [
                {
                  id: "status",
                  label: "Durum",
                  options: getStatusOptions("service"),
                  getValue: SERVICE_FILTER_VALUES.status,
                },
              ]
        }
        rowHref={(s) => detailHref(s.id)}
        rowActions={rowActions}
        mobileCard={(s) => (
          <ListRow
            title={serviceTitle(s)}
            subtitle={`${s.customer.name} · ${s.product.name}`}
            trailing={<PeriodAmount row={s} />}
            meta={
              <>
                <StatusBadge kind="service" status={s.status} />
                <span>Yenileme {formatDate(s.nextDueDate)}</span>
                {showReason && s.suspendReason ? <span className="w-full truncate">{s.suspendReason}</span> : null}
              </>
            }
          />
        )}
        emptyState={
          <EmptyState
            icon={Package}
            title={view.status ? "Bu durumda hizmet yok" : "Henüz hizmet yok"}
            description="Siparişler tamamlandığında veya elle hizmet eklediğinizde burada listelenir."
            action={
              <Link href="/yonetim/hizmet-ekle" prefetch={false} className={appButton({ variant: "outline", size: "sm" })}>
                <Plus aria-hidden />
                Hizmet ekle
              </Link>
            }
          />
        }
        noResultsText="Aramanızla eşleşen hizmet bulunamadı."
        {...admin.tableProps}
        toolbar={admin.toolbar}
      />

      <ServerPager page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} noun="hizmet" />
    </>
  );
}
