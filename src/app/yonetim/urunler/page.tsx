import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Box, Layers, Package, Percent, Plus, ShoppingCart, Tag } from "lucide-react";
import { IconTile, PageHeader, SectionCard, StatCard, StatGrid, appButton } from "@/components/app";
import { categoryConfig } from "@/lib/products/constants";
import { getProductStats, getProductCategoryCounts } from "@/lib/dal/products";
import { getPromotions } from "@/lib/dal/promotions";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Ürün yönetimi" };

export default async function ProductsDashboardPage() {
  await requirePermission("products.manage");
  const [stats, categoryCounts, promotions] = await Promise.all([
    getProductStats(),
    getProductCategoryCounts(),
    getPromotions({ status: "ACTIVE" }),
  ]);

  const quickLinks = [
    {
      title: "Kategoriler",
      description: "Kategori adları, sıralama ve görünürlük",
      href: "/yonetim/urunler/kategoriler",
      icon: Layers,
      count: `${stats.totalCategories} kategori`,
    },
    {
      title: "Paketler",
      description: "Ürünler, fiyat dönemleri ve stok",
      href: "/yonetim/urunler/paketler",
      icon: Box,
      count: `${stats.totalProducts} paket`,
    },
    {
      title: "Özellikler",
      description: "Paketlerde kullanılan özellik tanımları",
      href: "/yonetim/urunler/ozellikler",
      icon: Tag,
      count: null,
    },
    {
      title: "Promosyonlar",
      description: "İndirim kodları ve kampanyalar",
      href: "/yonetim/urunler/promosyonlar",
      icon: Percent,
      count: `${promotions.length} aktif kod`,
    },
    {
      title: "Siparişler",
      description: "Paketlerden oluşan siparişler",
      href: "/yonetim/siparisler",
      icon: ShoppingCart,
      count: null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Ürün yönetimi"
        description="Paketler, kategoriler, özellikler ve promosyonlar."
        actions={
          <Link href="/yonetim/urunler/paketler/yeni" className={appButton()}>
            <Plus aria-hidden />
            Yeni paket
          </Link>
        }
      />

      <StatGrid columns={4}>
        <StatCard
          label="Toplam ürün"
          value={stats.totalProducts}
          hint={`${stats.activeProducts} aktif, ${stats.draftProducts} taslak`}
          href="/yonetim/urunler/paketler"
        />
        <StatCard
          label="Aktif ürün"
          value={stats.activeProducts}
          hint="Yayında"
          tone={stats.activeProducts ? "success" : undefined}
        />
        <StatCard label="Taslak" value={stats.draftProducts} hint="Yayınlanmadı" />
        <StatCard
          label="Kategori"
          value={stats.totalCategories}
          hint="Aktif kategori"
          href="/yonetim/urunler/kategoriler"
        />
      </StatGrid>

      <SectionCard title="Katalog" description="Ürün kataloğunun bölümlerine hızlı erişim." flush>
        <ul className="grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5">
          {quickLinks.map((link) => (
            <li key={link.href} className="sm:border-b lg:border-b-0 lg:border-r lg:last:border-r-0">
              <Link
                href={link.href}
                className="group flex h-full items-start gap-3 p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <IconTile size="sm">
                  <link.icon aria-hidden className="size-4" />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-sm font-medium">
                    {link.title}
                    <ArrowUpRight
                      aria-hidden
                      className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{link.description}</p>
                  {link.count ? (
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      {link.count}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="Kategoriler"
        description="Kategori bazlı ürün dağılımı. Bir kategoriye tıklayarak paketlerini listeleyin."
        actions={
          <Link href="/yonetim/urunler/kategoriler" className={appButton({ variant: "ghost", size: "sm" })}>
            Tümünü gör
            <ArrowUpRight aria-hidden />
          </Link>
        }
      >
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
          {categoryCounts.map((cat) => {
            const config = categoryConfig[cat.slug as keyof typeof categoryConfig];
            if (!config) return null;
            const Icon = config.icon ?? Package;
            return (
              <li key={cat.slug}>
                <Link
                  href={`/yonetim/urunler/paketler?kategori=${cat.slug}`}
                  className="group flex h-full items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <IconTile size="sm">
                    <Icon aria-hidden className="size-4" />
                  </IconTile>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{config.name}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">{cat.productCount} ürün</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </SectionCard>
    </>
  );
}
