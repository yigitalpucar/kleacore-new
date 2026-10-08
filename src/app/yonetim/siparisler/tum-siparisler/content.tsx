"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader, StatCard, StatGrid, appButton, getStatusOptions } from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import { OrderTable, type OrderRow } from "../_components/order-list";

interface AllOrdersContentProps {
  orders: OrderRow[];
  total: number;
  page: number;
  totalPages: number;
  stats: { total: number; pending: number; processing: number; completed: number; cancelled: number };
}

export function AllOrdersContent({ orders, total, page, totalPages, stats }: AllOrdersContentProps) {
  const n = (v: number) => v.toLocaleString("tr-TR");
  return (
    <>
      <PageHeader
        title="Tüm siparişler"
        description="Sistemdeki bütün siparişler; duruma göre filtreleyin veya arayın."
        actions={
          <Link href="/yonetim/hizmet-ekle" className={appButton()}>
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
            getValue: (o) => o.status,
          },
        ]}
        emptyTitle="Henüz sipariş yok"
        emptyDescription="Müşteriler sipariş verdiğinde burada listelenir."
      />

      <ServerPager page={page} totalPages={totalPages} total={total} noun="sipariş" />
    </>
  );
}
