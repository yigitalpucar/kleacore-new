"use client";

import Link from "next/link";
import { Eye, Puzzle, UserRound } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  PageHeader,
  StatusBadge,
  type ColumnDef,
  type StatusTone,
} from "@/components/app";
import { formatDate } from "@/lib/format/date";
import { money } from "../_components/order-list";

interface AddonItem {
  id: string;
  customer: string;
  customerId: string;
  companyName: string | null;
  orderId: string;
  mainProduct: string;
  addonName: string;
  price: number;
  period: string;
  status: string;
  createdAt: string;
}

interface EklentilerContentProps {
  addons: AddonItem[];
}

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  active: { label: "Aktif", tone: "success" },
  pending: { label: "Beklemede", tone: "warning" },
  cancelled: { label: "İptal edildi", tone: "muted" },
};

function AddonStatus({ status }: { status: string }) {
  const meta = STATUS[status] ?? { label: status, tone: "muted" as const };
  return <StatusBadge tone={meta.tone} label={meta.label} />;
}

const tr = (s: string | null) => (s ?? "").toLocaleLowerCase("tr-TR");

const columns: ColumnDef<AddonItem>[] = [
  {
    accessorKey: "addonName",
    header: "Eklenti",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[240px]">
        <p className="truncate font-medium">{row.original.addonName}</p>
        <p className="truncate text-xs text-muted-foreground">{row.original.mainProduct}</p>
      </div>
    ),
  },
  {
    accessorKey: "customer",
    header: "Müşteri",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[220px]">
        <Link href={`/yonetim/musteriler/${row.original.customerId}`} className="block truncate hover:underline">
          {row.original.customer}
        </Link>
        {row.original.companyName ? (
          <p className="truncate text-xs text-muted-foreground">{row.original.companyName}</p>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "period",
    header: "Dönem",
    enableSorting: false,
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.period}</span>,
  },
  {
    accessorKey: "createdAt",
    header: "Tarih",
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
  },
  {
    accessorKey: "price",
    header: "Tutar",
    meta: { align: "right" },
    cell: ({ row }) => <span className="whitespace-nowrap font-medium tabular-nums">{money(row.original.price)}</span>,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <AddonStatus status={row.original.status} />,
  },
];

export function EklentilerContent({ addons }: EklentilerContentProps) {
  return (
    <>
      <PageHeader
        title="Sipariş eklentileri"
        description="Siparişlere eklenen ek hizmetler (yedekleme, IP, lisans vb.). Tutarlar sipariş dönemi içindir."
        meta={<StatusBadge tone="neutral" label={`${addons.length.toLocaleString("tr-TR")} eklenti`} />}
      />

      <DataTable
        caption="Sipariş eklentileri"
        columns={columns}
        data={addons}
        initialSort={[{ id: "createdAt", desc: true }]}
        searchFn={(a, q) =>
          tr(a.addonName).includes(q) || tr(a.customer).includes(q) || tr(a.companyName).includes(q) || tr(a.mainProduct).includes(q)
        }
        searchPlaceholder="Eklenti, müşteri veya ürün ara…"
        filters={[
          {
            id: "status",
            label: "Durum",
            options: Object.entries(STATUS).map(([value, m]) => ({ value, label: m.label })),
            getValue: (a) => a.status,
          },
        ]}
        rowHref={(a) => `/yonetim/siparisler/${a.orderId}`}
        rowActions={(a) => [
          { label: "Siparişi görüntüle", href: `/yonetim/siparisler/${a.orderId}`, icon: <Eye aria-hidden /> },
          { label: "Müşteriyi görüntüle", href: `/yonetim/musteriler/${a.customerId}`, icon: <UserRound aria-hidden /> },
        ]}
        mobileCard={(a) => (
          <ListRow
            title={a.addonName}
            subtitle={`${a.customer} · ${a.mainProduct}`}
            trailing={money(a.price)}
            meta={
              <>
                <AddonStatus status={a.status} />
                <span>{a.period}</span>
                <span>{formatDate(a.createdAt)}</span>
              </>
            }
          />
        )}
        emptyState={
          <EmptyState
            icon={Puzzle}
            title="Eklenti bulunmuyor"
            description="Siparişlerde ek hizmet kalemi olduğunda burada listelenir."
          />
        }
        noResultsText="Aramanızla eşleşen eklenti bulunamadı."
      />
    </>
  );
}
