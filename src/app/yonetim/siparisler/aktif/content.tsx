"use client";

import type { ListCapabilities } from "@/lib/admin/list-views";
import { PageHeader, StatusBadge } from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import { OrderTable, useOrderListTools, type OrderRow } from "../_components/order-list";

interface ActiveOrdersContentProps {
  orders: OrderRow[];
  total: number;
  page: number;
  totalPages: number;
  capabilities?: ListCapabilities;
  activeCount: number;
}

export function ActiveOrdersContent({ orders, total, page, totalPages, activeCount, capabilities }: ActiveOrdersContentProps) {
  const tools = useOrderListTools({ scope: "processing", capabilities });
  return (
    <>
      <PageHeader
        title="Aktif siparişler"
        description="Onaylanmış ve kurulumu süren (işleniyor) siparişler."
        meta={<StatusBadge tone="info" label={`${activeCount.toLocaleString("tr-TR")} sipariş işleniyor`} />}
      />

      <OrderTable
        rows={orders}
        emptyTitle="İşlenen sipariş yok"
        emptyDescription="Onaylanan siparişler kurulum tamamlanana kadar burada görünür."
        {...tools.tableProps}
        toolbar={tools.toolbar}
      />

      <ServerPager page={page} totalPages={totalPages} total={total} noun="sipariş" />
    </>
  );
}
