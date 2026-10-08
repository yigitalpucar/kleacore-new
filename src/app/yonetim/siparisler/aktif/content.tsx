"use client";

import { PageHeader, StatusBadge } from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import { OrderTable, type OrderRow } from "../_components/order-list";

interface ActiveOrdersContentProps {
  orders: OrderRow[];
  total: number;
  page: number;
  totalPages: number;
  activeCount: number;
}

export function ActiveOrdersContent({ orders, total, page, totalPages, activeCount }: ActiveOrdersContentProps) {
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
      />

      <ServerPager page={page} totalPages={totalPages} total={total} noun="sipariş" />
    </>
  );
}
