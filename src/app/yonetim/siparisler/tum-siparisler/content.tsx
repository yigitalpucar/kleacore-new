"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader, StatCard, StatGrid, appButton, getStatusOptions } from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import { OrderTable, useOrderListTools, type OrderRow } from "../_components/order-list";
import type { ListCapabilities } from "@/lib/admin/list-views";
import { ORDER_FILTER_VALUES } from "../_components/serialize";

interface AllOrdersContentProps {
  orders: OrderRow[];
  total: number;
  page: number;
  totalPages: number;
  stats: { total: number; pending: number; processing: number; completed: number; cancelled: number };
  capabilities?: ListCapabilities;
}

export function AllOrdersContent({ orders, total, page, totalPages, stats, capabilities }: AllOrdersContentProps) {
  const tools = useOrderListTools({ scope: "all", filterIds: ["status"], capabilities });
  const n = (v: number) => v.toLocaleString("tr-TR");
  return (
    <>
      <PageHeader
        title="Tüm siparişler"
        description="Sistemdeki bütün siparişler; duruma göre filtreleyin veya arayın."
        actions={
          <Link href="/yonetim/hizmet-ekle" prefetch={false} className={appButton()}>
            <Plus aria-hidden />
            Yeni sipariş
          </Link>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Toplam" value={n(stats.total)} hint={`${n(stats.completed)} tamamlandı`} />
        <StatCard
          label="Beklemede"
          value={n(stats.pending)}
          hint={stats.pending ? "Onay bekliyor" : "Bekleyen sipariş yok"}
          tone={stats.pending ? "warning" : undefined}
          href="/yonetim/siparisler/beklemede"
        />
        <StatCard label="İşleniyor" value={n(stats.processing)} hint="Kurulumu süren siparişler" href="/yonetim/siparisler/aktif" />
        <StatCard label="İptal edilen" value={n(stats.cancelled)} hint="İptal edilmiş siparişler" href="/yonetim/siparisler/iptal" />
      </StatGrid>

      <OrderTable
        rows={orders}
        filters={[
          {
            id: "status",
            label: "Durum",
            options: getStatusOptions("order"),
            getValue: ORDER_FILTER_VALUES.status,
          },
        ]}
        emptyTitle="Henüz sipariş yok"
        emptyDescription="Müşteriler sipariş verdiğinde burada listelenir."
        {...tools.tableProps}
        toolbar={tools.toolbar}
      />

      <ServerPager page={page} totalPages={totalPages} total={total} noun="sipariş" />
    </>
  );
}
