import Link from "next/link";
import {
  Package,
  ShoppingCart,
  Tag,
  TrendingUp,
  ArrowUpRight,
  CheckCircle,
  Clock,
  Layers,
  Box,
  Percent,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import { categoryConfig } from "@/lib/products/constants";
import { getProductStats, getProductCategoryCounts } from "@/lib/dal/products";
import { getPromotions } from "@/lib/dal/promotions";
import type { ProductCategorySlug } from "@/types/products";

export const dynamic = "force-dynamic";

export default async function ProductsDashboardPage() {
  const [stats, categoryCounts, promotions] = await Promise.all([
    getProductStats(),
    getProductCategoryCounts(),
    getPromotions({ status: "ACTIVE" }),
  ]);

  const quickLinks = [
    { title: "Kategoriler", href: "/yonetim/urunler/kategoriler", icon: Layers, count: stats.totalCategories },
    { title: "Paketler", href: "/yonetim/urunler/paketler", icon: Box, count: stats.totalProducts },
    { title: "Özellikler", href: "/yonetim/urunler/ozellikler", icon: Tag, count: 0 },
    { title: "Promosyonlar", href: "/yonetim/urunler/promosyonlar", icon: Percent, count: promotions.length },
    { title: "Siparisler", href: "/yonetim/siparisler", icon: ShoppingCart, count: 0 },
  ];

  const statCards = [
    {
      title: "Toplam Ürün",
      value: stats.totalProducts.toString(),
      description: `${stats.activeProducts} aktif, ${stats.draftProducts} taslak`,
      icon: Package,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Aktif Ürün",
      value: stats.activeProducts.toString(),
      description: "Yayında",
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Taslak",
      value: stats.draftProducts.toString(),
      description: "Yayınlanmadı",
      icon: Clock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      title: "Kategori",
      value: stats.totalCategories.toString(),
      description: "Aktif kategori",
      icon: Layers,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Ürün Yönetimi</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Ürünler, kategoriler ve promosyonlar</p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href="/yonetim/urunler/paketler/yeni">
              <Package className="mr-2 h-4 w-4" />
              Yeni Paket
            </Link>
          </Button>
        </div>
      </BlurFade>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <BlurFade key={stat.title} delay={0.1 + index * 0.05}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                    <stat.icon className={cn("h-5 w-5", stat.color)} />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold text-zinc-900 dark:text-white">{stat.value}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{stat.title}</p>
                <p className="text-xs text-zinc-500 mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          </BlurFade>
        ))}
      </div>

      {/* Quick Links */}
      <BlurFade delay={0.3}>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-all group"
            >
              <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 transition-colors">
                <link.icon className="h-5 w-5 text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">{link.title}</p>
                <p className="text-xs text-zinc-500">{link.count} kayıt</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </Link>
          ))}
        </div>
      </BlurFade>

      {/* Categories Overview */}
      <BlurFade delay={0.5}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-zinc-900 dark:text-white">Kategoriler</CardTitle>
              <CardDescription className="text-zinc-400">
                Kategori bazlı ürün dağılımı
              </CardDescription>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            >
              <Link href="/yonetim/urunler/kategoriler">
                Tümünü Gör
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
              {categoryCounts.map((cat) => {
                const config = categoryConfig[cat.slug as keyof typeof categoryConfig];
                if (!config) return null;
                const Icon = config.icon;

                return (
                  <Link
                    key={cat.slug}
                    href={`/yonetim/urunler/paketler?kategori=${cat.slug}`}
                    className="flex flex-col items-center p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 transition-all text-center group"
                  >
                    <div className={cn("p-3 rounded-lg mb-2", config.color)}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white group-hover:text-primary transition-colors">
                      {config.name}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {cat.productCount} ürün
                    </p>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
