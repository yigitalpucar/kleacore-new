"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, Play, XCircle } from "lucide-react";
import { PageHeader, StatusBadge, appButton, type ColumnDef } from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import {
  activateSuspendedOrder,
  cancelSuspendedOrder,
} from "@/lib/actions/admin/suspended-orders";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/format/date";
import {
  OrderMobileCard,
  OrderTable,
  amountColumn,
  baseOrderActions,
  createdColumn,
  customerColumn,
  orderNumberColumn,
  productColumn,
  type OrderRow,
} from "../_components/order-list";

interface SuspendedOrdersContentProps {
  orders: OrderRow[];
  total: number;
  page: number;
  totalPages: number;
}

export function SuspendedOrdersContent({ orders, total, page, totalPages }: SuspendedOrdersContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  const handleActivate = (orderId: string) => {
    setProcessingOrderId(orderId);
    startTransition(async () => {
      try {
        const result = await activateSuspendedOrder(orderId);
        if (!result.success) {
          toast.error(result.error || "Sipariş aktifleştirilemedi");
          return;
        }
        toast.success("Askıdaki hizmet aktifleştirildi");
        router.refresh();
      } finally {
        setProcessingOrderId(null);
      }
    });
  };

  const handleCancel = (orderId: string) => {
    const reason = prompt("İptal nedeni (opsiyonel):");
    if (reason === null) return;
    setProcessingOrderId(orderId);
    startTransition(async () => {
      try {
        const result = await cancelSuspendedOrder(orderId, reason);
        if (!result.success) {
          toast.error(result.error || "Sipariş iptal edilemedi");
          return;
        }
        toast.success("Askıdaki hizmet iptal edildi");
        router.refresh();
      } finally {
        setProcessingOrderId(null);
      }
    });
  };

  const columns: ColumnDef<OrderRow>[] = [
    orderNumberColumn,
    customerColumn,
    productColumn,
    {
      id: "reason",
      accessorFn: (r) => r.suspendReason ?? "",
      header: "Askı nedeni",
      enableSorting: false,
      cell: ({ row }) => (
        <p className="line-clamp-2 max-w-[240px] text-muted-foreground">{row.original.suspendReason || "—"}</p>
      ),
    },
    createdColumn,
    amountColumn,
    {
      id: "decide",
      header: () => <span className="sr-only">İşlemler</span>,
      enableSorting: false,
      meta: { align: "right", className: "w-px" },
      cell: ({ row }) => {
        const busy = isPending && processingOrderId === row.original.id;
        return (
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleActivate(row.original.id)}
              className={appButton({ variant: "outline", size: "sm" })}
            >
              <Play aria-hidden />
              {busy ? "İşleniyor…" : "Aktifleştir"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleCancel(row.original.id)}
              aria-label={`${row.original.orderNumber} siparişini iptal et`}
              className={appButton({ variant: "ghost", size: "icon-sm" })}
            >
              <XCircle aria-hidden />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Askıdaki siparişler"
        description="Hizmeti askıya alınmış siparişler. Ödeme veya sorun çözüldüğünde hizmeti yeniden aktifleştirin."
        meta={
          <StatusBadge
            tone={total ? "warning" : "muted"}
            label={total ? `${total.toLocaleString("tr-TR")} sipariş askıda` : "Askıda sipariş yok"}
          />
        }
      />

      <OrderTable
        rows={orders}
        columns={columns}
        rowActions={(o) => [
          { label: "Aktifleştir", icon: <Play aria-hidden />, onSelect: () => handleActivate(o.id) },
          { label: "İptal et", icon: <XCircle aria-hidden />, onSelect: () => handleCancel(o.id), destructive: true },
          ...baseOrderActions(o).map((a, i) => (i === 0 ? { ...a, separator: true } : a)),
          ...(o.serviceId
            ? [{ label: "Hizmeti görüntüle", href: `/yonetim/hizmetler/${o.serviceId}`, icon: <Package aria-hidden /> }]
            : []),
        ]}
        mobileCard={(o) => (
          <OrderMobileCard
            o={o}
            meta={
              <>
                <StatusBadge kind="service" status="SUSPENDED" />
                <span>{formatDate(o.createdAt)}</span>
                {o.suspendReason ? <span className="w-full truncate">{o.suspendReason}</span> : null}
              </>
            }
          />
        )}
        emptyTitle="Askıda sipariş yok"
        emptyDescription="Hizmeti askıya alınan siparişler burada listelenir."
      />

      <ServerPager page={page} totalPages={totalPages} total={total} noun="sipariş" />
    </>
  );
}
