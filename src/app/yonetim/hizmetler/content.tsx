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
import { formatTRY } from "@/lib/format/price";
import { billingPeriodLabel, billingPeriodUnit, formatDate } from "@/lib/format/date";
import { toast } from "@/lib/toast";

export type ServiceListRow = {
  id: string;
  label: string;
  domain: string | null;
  ipAddress: string | null;
  serverName: string | null;
  status: string;
  billingPeriod: string;
  /** Charge for ONE billing period (yearly services store the yearly total). */
  amount: number;
  nextDueDate: string | null;
  suspendReason: string | null;
  createdAt: string;
  customer: { id: string; name: string; email: string };
  product: { name: string; sku: string; categorySlug: string | null; categoryName: string | null };
};

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
};

const money = (n: number) => formatTRY(n, { keepDecimals: true });
const detailHref = (id: string) => `/yonetim/hizmetler/${id}`;
const tr = (s: string | null | undefined) => (s ?? "").toLocaleLowerCase("tr-TR");

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

export function ServicesContent({ rows, stats, pagination, view }: ServicesContentProps) {
  const router = useRouter();

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
          <Link href="/yonetim/hizmet-ekle" className={appButton()}>
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
        getRowId={(s) => s.id}
        initialSort={[{ id: "nextDueDate", desc: false }]}
        searchFn={(s, q) =>
          tr(s.id).includes(q) ||
          tr(s.domain).includes(q) ||
          tr(s.label).includes(q) ||
          tr(s.ipAddress).includes(q) ||
          tr(s.customer.name).includes(q) ||
          tr(s.customer.email).includes(q) ||
          tr(s.product.name).includes(q)
        }
        searchPlaceholder="Domain, müşteri, paket, IP veya hizmet ID ara…"
        filters={
          view.status
            ? []
            : [
                {
                  id: "status",
                  label: "Durum",
                  options: getStatusOptions("service"),
                  getValue: (s) => s.status,
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
              <Link href="/yonetim/hizmet-ekle" className={appButton({ variant: "outline", size: "sm" })}>
                <Plus aria-hidden />
                Hizmet ekle
              </Link>
            }
          />
        }
        noResultsText="Aramanızla eşleşen hizmet bulunamadı."
      />

      <ServerPager page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} noun="hizmet" />
    </>
  );
}
