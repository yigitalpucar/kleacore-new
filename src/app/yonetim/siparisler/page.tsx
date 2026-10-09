import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { PageHeader, SectionCard, StatCard, StatGrid, appButton } from "@/components/app";
import { getOrders, getOrderStats } from "@/lib/dal/orders";
import { formatTRY } from "@/lib/format/price";
import { OrderTable } from "./_components/order-list";
import { serializeOrder } from "./_components/serialize";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Siparişler" };

export default async function OrdersDashboardPage() {
  await requirePermission("orders.view");
  const [stats, recentResult] = await Promise.all([
    getOrderStats(),
    getOrders({ page: 1, perPage: 8, sortBy: "createdAt", sortOrder: "desc" }),
  ]);

  const n = (v: number) => v.toLocaleString("tr-TR");

  const recent = recentResult.data.map(serializeOrder);


  return (
    <>
      <PageHeader
        title="Siparişler"
        description="Siparişleri onaylayın, durumlarını takip edin ve iptal taleplerini yönetin."
        actions={
          <Link href="/yonetim/hizmet-ekle" prefetch={false} className={appButton()}>
            <Plus aria-hidden />
            Yeni sipariş
          </Link>
        }
      />

      <StatGrid columns={4}>
        <StatCard
          label="Toplam sipariş"
          value={n(stats.total)}
          hint={`${n(stats.completed)} tamamlandı`}
          href="/yonetim/siparisler/tum-siparisler"
        />
        <StatCard
          label="Onay bekleyen"
          value={n(stats.pending)}
          hint={stats.pending ? "İnceleme bekliyor" : "Bekleyen sipariş yok"}
          tone={stats.pending ? "warning" : undefined}
          href="/yonetim/siparisler/beklemede"
        />
        <StatCard
          label="İşleniyor"
          value={n(stats.processing)}
          hint="Kurulumu süren siparişler"
          href="/yonetim/siparisler/aktif"
        />
        <StatCard
          label="Tamamlanan tutar"
          value={formatTRY(Number(stats.totalRevenue), { keepDecimals: true })}
          hint="Tamamlanan siparişlerin toplamı"
        />
      </StatGrid>

      <SectionCard
        title="Son siparişler"
        description="En yeni 8 sipariş"
        flush
        actions={
          <Link href="/yonetim/siparisler/tum-siparisler" className={appButton({ variant: "ghost", size: "sm" })}>
            Tümünü gör
            <ArrowRight aria-hidden />
          </Link>
        }
      >
        <OrderTable rows={recent} framed={false} pageSize={0} searchable={false} emptyTitle="Henüz sipariş yok" />
      </SectionCard>

    </>
  );
}
