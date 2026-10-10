"use client";

import type { ListCapabilities } from "@/lib/admin/list-views";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { PageHeader, StatusBadge, appButton, type ColumnDef } from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import { approveOrder, rejectOrder } from "@/lib/actions/admin/orders";
import { toast } from "@/lib/toast";
import {
  OrderTable,
  useOrderListTools,
  amountColumn,
  baseOrderActions,
  createdColumn,
  customerColumn,
  orderNumberColumn,
  productColumn,
  type OrderRow,
} from "../_components/order-list";

interface PendingOrdersContentProps {
  orders: OrderRow[];
  total: number;
  page: number;
  totalPages: number;
  capabilities?: ListCapabilities;
  pendingCount: number;
}

export function PendingOrdersContent({ orders, total, page, totalPages, pendingCount, capabilities }: PendingOrdersContentProps) {
  const tools = useOrderListTools({ scope: "pending", capabilities });
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleApprove = (id: string) => {
    setBusyId(id);
    startTransition(async () => {
      try {
        const result = await approveOrder(id);
        if (!result.success) {
          toast.error(result.error || "Sipariş onaylanamadı");
          return;
        }
        toast.success("Sipariş onaylandı");
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  };

  const handleReject = (id: string) => {
    const reason = prompt("Ret nedeni:");
    if (!reason) return;
    setBusyId(id);
    startTransition(async () => {
      try {
        const result = await rejectOrder(id, reason);
        if (!result.success) {
          toast.error(result.error || "Sipariş reddedilemedi");
          return;
        }
        toast.success("Sipariş reddedildi");
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  };

  const actionsColumn: ColumnDef<OrderRow> = {
    id: "decide",
    header: () => <span className="sr-only">Karar</span>,
    enableSorting: false,
    meta: { align: "right", className: "w-px" },
    cell: ({ row }) => {
      const busy = isPending && busyId === row.original.id;
      return (
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleApprove(row.original.id)}
            className={appButton({ variant: "outline", size: "sm" })}
          >
            <Check aria-hidden />
            {busy ? "İşleniyor…" : "Onayla"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleReject(row.original.id)}
            aria-label={`${row.original.orderNumber} siparişini reddet`}
            className={appButton({ variant: "ghost", size: "icon-sm" })}
          >
            <X aria-hidden />
          </button>
        </div>
      );
    },
  };

  return (
    <>
      <PageHeader
        title="Bekleyen siparişler"
        description="Onay bekleyen siparişleri inceleyin; onaylanan siparişler kurulum sırasına alınır."
        meta={
          <StatusBadge
            tone={pendingCount ? "warning" : "muted"}
            label={pendingCount ? `${pendingCount.toLocaleString("tr-TR")} sipariş onay bekliyor` : "Bekleyen sipariş yok"}
          />
        }
      />

      <OrderTable
        rows={orders}
        columns={[orderNumberColumn, customerColumn, productColumn, createdColumn, amountColumn, actionsColumn]}
        initialSort={[{ id: "createdAt", desc: false }]}
        rowActions={(o) => [
          { label: "Onayla", icon: <Check aria-hidden />, onSelect: () => handleApprove(o.id) },
          { label: "Reddet", icon: <X aria-hidden />, onSelect: () => handleReject(o.id), destructive: true },
          ...baseOrderActions(o).map((a, i) => (i === 0 ? { ...a, separator: true } : a)),
        ]}
        emptyTitle="Bekleyen sipariş yok"
        emptyDescription="Yeni siparişler onayınıza düştüğünde burada görünür."
        {...tools.tableProps}
        toolbar={tools.toolbar}
      />

      <ServerPager page={page} totalPages={totalPages} total={total} noun="sipariş" />
    </>
  );
}
