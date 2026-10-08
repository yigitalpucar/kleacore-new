"use client";

import Link from "next/link";
import { Eye, ShoppingCart, UserRound } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  StatusBadge,
  type ColumnDef,
  type DataTableProps,
  type RowAction,
} from "@/components/app";
import { formatTRY } from "@/lib/format/price";
import { formatDate } from "@/lib/format/date";

type DateLike = string | Date;

export interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: DateLike;
  cancelledAt?: DateLike | null;
  cancellationReason?: string | null;
  refundedAt?: DateLike | null;
  refundAmount?: number | null;
  serviceId?: string | null;
  suspendReason?: string | null;
  customer: {
    id: string;
    name: string;
    surname: string;
    email: string;
  };
  product: {
    id?: string;
    name: string;
    sku?: string;
    category?: { name: string } | null;
  };
}

export const money = (n: number | null | undefined) => formatTRY(Number(n ?? 0), { keepDecimals: true });
export const orderHref = (id: string) => `/yonetim/siparisler/${id}`;
export const customerHref = (id: string) => `/yonetim/musteriler/${id}`;
export const customerName = (c: { name: string; surname: string }) => `${c.name} ${c.surname}`.trim();

const tr = (s: string | null | undefined) => (s ?? "").toLocaleLowerCase("tr-TR");

export function orderSearch(o: OrderRow, q: string) {
  return (
    tr(o.orderNumber).includes(q) ||
    tr(customerName(o.customer)).includes(q) ||
    tr(o.customer.email).includes(q) ||
    tr(o.product.name).includes(q)
  );
}

export const orderNumberColumn: ColumnDef<OrderRow> = {
  accessorKey: "orderNumber",
  header: "Sipariş",
  cell: ({ row }) => (
    <Link href={orderHref(row.original.id)} className="whitespace-nowrap font-mono text-[13px] font-medium hover:underline">
      {row.original.orderNumber}
    </Link>
  ),
};

export const customerColumn: ColumnDef<OrderRow> = {
  id: "customer",
  accessorFn: (r) => customerName(r.customer),
  header: "Müşteri",
  cell: ({ row }) => (
    <div className="min-w-0 max-w-[240px]">
      <Link href={customerHref(row.original.customer.id)} className="block truncate font-medium hover:underline">
        {customerName(row.original.customer)}
      </Link>
      <p className="truncate text-xs text-muted-foreground">{row.original.customer.email}</p>
    </div>
  ),
};

export const productColumn: ColumnDef<OrderRow> = {
  id: "product",
  accessorFn: (r) => r.product.name,
  header: "Ürün",
  cell: ({ row }) => (
    <div className="min-w-0 max-w-[220px]">
      <p className="truncate">{row.original.product.name}</p>
      {row.original.product.category?.name ? (
        <p className="truncate text-xs text-muted-foreground">{row.original.product.category.name}</p>
      ) : null}
    </div>
  ),
};

export const amountColumn: ColumnDef<OrderRow> = {
  accessorKey: "totalAmount",
  header: "Tutar",
  meta: { align: "right" },
  cell: ({ row }) => <span className="whitespace-nowrap font-medium tabular-nums">{money(row.original.totalAmount)}</span>,
};

export const createdColumn: ColumnDef<OrderRow> = {
  id: "createdAt",
  accessorFn: (r) => new Date(r.createdAt).toISOString(),
  header: "Tarih",
  cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
};

export const statusColumn: ColumnDef<OrderRow> = {
  accessorKey: "status",
  header: "Durum",
  enableSorting: false,
  cell: ({ row }) => <StatusBadge kind="order" status={row.original.status} />,
};

/** Default row menu entries for an order (view order, view customer). */
export function baseOrderActions(o: OrderRow): RowAction[] {
  return [
    { label: "Siparişi görüntüle", href: orderHref(o.id), icon: <Eye aria-hidden /> },
    { label: "Müşteriyi görüntüle", href: customerHref(o.customer.id), icon: <UserRound aria-hidden /> },
  ];
}

export function OrderMobileCard({ o, meta }: { o: OrderRow; meta?: React.ReactNode }) {
  return (
    <ListRow
      title={<span className="font-mono text-[13px]">{o.orderNumber}</span>}
      subtitle={`${customerName(o.customer)} · ${o.product.name}`}
      trailing={money(o.totalAmount)}
      meta={
        meta ?? (
          <>
            <StatusBadge kind="order" status={o.status} />
            <span>{formatDate(o.createdAt)}</span>
          </>
        )
      }
    />
  );
}

/** DataTable preset for order lists. */
export function OrderTable({
  rows,
  columns,
  emptyTitle = "Sipariş bulunmuyor",
  emptyDescription,
  searchable = true,
  ...rest
}: {
  rows: OrderRow[];
  /** Server pages can't pass `searchFn={undefined}`; use this to hide the search box. */
  searchable?: boolean;
  columns?: ColumnDef<OrderRow>[];
  emptyTitle?: string;
  emptyDescription?: string;
} & Partial<Omit<DataTableProps<OrderRow>, "data" | "columns">>) {
  return (
    <DataTable
      caption="Siparişler"
      columns={columns ?? [orderNumberColumn, customerColumn, productColumn, createdColumn, amountColumn, statusColumn]}
      data={rows}
      initialSort={[{ id: "createdAt", desc: true }]}
      searchFn={searchable ? orderSearch : undefined}
      searchPlaceholder="Sipariş, müşteri veya ürün ara…"
      rowHref={(o) => orderHref(o.id)}
      rowActions={baseOrderActions}
      mobileCard={(o) => <OrderMobileCard o={o} />}
      emptyState={<EmptyState icon={ShoppingCart} title={emptyTitle} description={emptyDescription} />}
      noResultsText="Aramanızla eşleşen sipariş bulunamadı."
      {...rest}
    />
  );
}
