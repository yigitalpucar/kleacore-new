"use client";

import Link from "next/link";
import { Eye, ShoppingCart, User } from "lucide-react";
import { DataTable, EmptyState, ListRow, StatusBadge, type ColumnDef } from "@/components/app";
import { formatTRY } from "@/lib/format/price";
import { formatDate } from "@/lib/format/date";

export type DashboardOrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  productName: string | null;
  customer: { id: string; name: string } | null;
};

const money = (n: number) => formatTRY(n, { keepDecimals: true });

const columns: ColumnDef<DashboardOrderRow>[] = [
  {
    accessorKey: "orderNumber",
    header: "Sipariş",
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link href={`/yonetim/siparisler/${row.original.id}`} className="font-mono text-[13px] font-medium hover:underline">
          {row.original.orderNumber}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{row.original.productName ?? "—"}</p>
      </div>
    ),
  },
  {
    id: "customer",
    accessorFn: (r) => r.customer?.name ?? "",
    header: "Müşteri",
    cell: ({ row }) =>
      row.original.customer ? (
        <Link href={`/yonetim/musteriler/${row.original.customer.id}`} className="hover:underline">
          {row.original.customer.name}
        </Link>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "createdAt",
    accessorFn: (r) => r.createdAt,
    header: "Tarih",
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
  },
  {
    accessorKey: "totalAmount",
    header: "Tutar",
    meta: { align: "right" },
    cell: ({ row }) => <span className="whitespace-nowrap font-medium tabular-nums">{money(row.original.totalAmount)}</span>,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="order" status={row.original.status} />,
  },
];

/** "Son siparişler" table on the admin dashboard (no toolbar, no pager). */
export function DashboardRecentOrders({ orders }: { orders: DashboardOrderRow[] }) {
  return (
    <DataTable
      caption="Son siparişler"
      framed={false}
      pageSize={0}
      columns={columns}
      data={orders}
      initialSort={[{ id: "createdAt", desc: true }]}
      rowHref={(o) => `/yonetim/siparisler/${o.id}`}
      rowActions={(o) => [
        { label: "Siparişi görüntüle", href: `/yonetim/siparisler/${o.id}`, icon: <Eye aria-hidden /> },
        ...(o.customer
          ? [{ label: "Müşteriyi görüntüle", href: `/yonetim/musteriler/${o.customer.id}`, icon: <User aria-hidden /> }]
          : []),
      ]}
      mobileCard={(o) => (
        <ListRow
          title={<span className="font-mono text-[13px]">{o.orderNumber}</span>}
          subtitle={[o.customer?.name, o.productName].filter(Boolean).join(" · ")}
          trailing={money(o.totalAmount)}
          meta={
            <>
              <StatusBadge kind="order" status={o.status} />
              <span>{formatDate(o.createdAt)}</span>
            </>
          }
        />
      )}
      emptyState={<EmptyState compact icon={ShoppingCart} title="Henüz sipariş yok" description="Yeni siparişler burada görünür." />}
    />
  );
}
