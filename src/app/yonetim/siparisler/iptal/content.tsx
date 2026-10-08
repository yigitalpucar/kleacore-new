"use client";

import { PageHeader, StatusBadge, type ColumnDef } from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import { formatDate } from "@/lib/format/date";
import {
  OrderMobileCard,
  OrderTable,
  amountColumn,
  customerColumn,
  money,
  orderNumberColumn,
  productColumn,
  type OrderRow,
} from "../_components/order-list";

interface CancelledOrdersContentProps {
  orders: OrderRow[];
  total: number;
  page: number;
  totalPages: number;
  cancelledCount: number;
}

function RefundBadge({ o }: { o: OrderRow }) {
  return o.refundedAt ? (
    <StatusBadge tone="neutral" label={o.refundAmount ? `İade edildi · ${money(o.refundAmount)}` : "İade edildi"} />
  ) : (
    <StatusBadge tone="muted" label="İade yok" />
  );
}

const columns: ColumnDef<OrderRow>[] = [
  orderNumberColumn,
  customerColumn,
  productColumn,
  {
    id: "reason",
    accessorFn: (r) => r.cancellationReason ?? "",
    header: "İptal nedeni",
    enableSorting: false,
    cell: ({ row }) => (
      <p className="line-clamp-2 max-w-[260px] text-muted-foreground">{row.original.cancellationReason || "—"}</p>
    ),
  },
  amountColumn,
  {
    id: "refund",
    header: "İade",
    enableSorting: false,
    cell: ({ row }) => <RefundBadge o={row.original} />,
  },
  {
    id: "createdAt",
    accessorFn: (r) => new Date(r.cancelledAt ?? r.createdAt).toISOString(),
    header: "İptal tarihi",
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{formatDate(row.original.cancelledAt)}</span>
    ),
  },
];

export function CancelledOrdersContent({ orders, total, page, totalPages, cancelledCount }: CancelledOrdersContentProps) {
  return (
    <>
      <PageHeader
        title="İptal edilen siparişler"
        description="İptal edilmiş siparişler, iptal nedenleri ve iade durumları."
        meta={<StatusBadge tone="muted" label={`${cancelledCount.toLocaleString("tr-TR")} iptal edilen sipariş`} />}
      />

      <OrderTable
        rows={orders}
        columns={columns}
        filters={[
          {
            id: "refund",
            label: "İade",
            options: [
              { value: "refunded", label: "İade edildi" },
              { value: "none", label: "İade yok" },
            ],
            getValue: (o) => (o.refundedAt ? "refunded" : "none"),
          },
        ]}
        mobileCard={(o) => (
          <OrderMobileCard
            o={o}
            meta={
              <>
                <RefundBadge o={o} />
                <span>İptal {formatDate(o.cancelledAt)}</span>
                {o.cancellationReason ? <span className="w-full truncate">{o.cancellationReason}</span> : null}
              </>
            }
          />
        )}
        emptyTitle="İptal edilen sipariş yok"
      />

      <ServerPager page={page} totalPages={totalPages} total={total} noun="sipariş" />
    </>
  );
}
