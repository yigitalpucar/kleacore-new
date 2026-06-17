import Link from "next/link";
import {
  ShoppingCart,
  CheckCircle,
  Clock,
  XCircle,
  ArrowUpDown,
  Puzzle,
  MessageSquareX,
  ArrowUpRight,
  TrendingUp,
  ListOrdered,
  Search,
  Plus,
  Pause,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import { getOrders, getOrderStats } from "@/lib/dal/orders";

export const dynamic = "force-dynamic";

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Beklemede", color: "bg-yellow-500/10 text-yellow-500" },
  APPROVED: { label: "Onaylandı", color: "bg-blue-500/10 text-blue-500" },
  PROCESSING: { label: "İşleniyor", color: "bg-green-500/10 text-green-500" },
  COMPLETED: { label: "Tamamlandı", color: "bg-green-500/10 text-green-500" },
  CANCELLED: { label: "İptal", color: "bg-red-500/10 text-red-500" },
  REFUNDED: { label: "İade", color: "bg-orange-500/10 text-orange-500" },
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(price);
};

export default async function OrdersDashboardPage() {
  const [stats, recentResult] = await Promise.all([
    getOrderStats(),
    getOrders({ page: 1, perPage: 5, sortBy: "createdAt", sortOrder: "desc" }),
  ]);

  const statCards = [
    {
      title: "Toplam Sipariş",
      value: stats.total.toLocaleString("tr-TR"),
      description: `${stats.pending} onay bekliyor`,
      icon: ShoppingCart,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      href: "/yonetim/siparisler/tum-siparisler",
    },
    {
      title: "Aktif Sipariş",
      value: stats.processing.toLocaleString("tr-TR"),
      description: `%${stats.total > 0 ? ((stats.processing / stats.total) * 100).toFixed(1) : 0} oran`,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      href: "/yonetim/siparisler/aktif",
    },
    {
      title: "Beklemede",
      value: stats.pending.toLocaleString("tr-TR"),
      description: "Onay bekliyor",
      icon: Clock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      href: "/yonetim/siparisler/beklemede",
    },
    {
      title: "Toplam Gelir",
      value: formatPrice(Number(stats.totalRevenue)),
      description: "Tamamlanan siparişler",
      icon: TrendingUp,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      href: "/yonetim/raporlar",
    },
  ];

  const quickLinks = [
    {
      title: "Tüm Siparişler",
      description: `${stats.total.toLocaleString("tr-TR")} sipariş`,
      icon: ListOrdered,
      href: "/yonetim/siparisler/tum-siparisler",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Aktif Siparişler",
      description: `${stats.processing.toLocaleString("tr-TR")} sipariş`,
      icon: CheckCircle,
      href: "/yonetim/siparisler/aktif",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Beklemede",
      description: `${stats.pending.toLocaleString("tr-TR")} sipariş`,
      icon: Clock,
      href: "/yonetim/siparisler/beklemede",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      title: "Askıda",
      description: "Askıdaki siparişler",
      icon: Pause,
      href: "/yonetim/siparisler/askida",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "İptal Edilen",
      description: `${stats.cancelled.toLocaleString("tr-TR")} sipariş`,
      icon: XCircle,
      href: "/yonetim/siparisler/iptal",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      title: "Yükseltme/Düşürme",
      description: "Paket değişiklikleri",
      icon: ArrowUpDown,
      href: "/yonetim/siparisler/yukseltme-dusurme",
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
    },
    {
      title: "Eklentiler",
      description: "Ek hizmetler",
      icon: Puzzle,
      href: "/yonetim/siparisler/eklentiler",
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
    {
      title: "İptal Talepleri",
      description: "Müşteri talepleri",
      icon: MessageSquareX,
      href: "/yonetim/siparisler/iptal-talepleri",
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Siparişler</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Tüm siparişleri yönetin ve takip edin</p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href="/yonetim/hizmet-ekle">
              <Plus className="mr-2 h-4 w-4" />
              Yeni Sipariş
            </Link>
          </Button>
        </div>
      </BlurFade>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <BlurFade key={stat.title} delay={0.1 + index * 0.05}>
            <Link href={stat.href}>
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-lg", stat.bgColor)}>
                      <stat.icon className={cn("h-6 w-6", stat.color)} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stat.value}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{stat.title}</p>
                      <p className="text-xs text-zinc-500">{stat.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </BlurFade>
        ))}
      </div>

      {/* Quick Links */}
      <BlurFade delay={0.3}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-900 dark:text-white">Hızlı Erişim</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group"
                >
                  <div className={cn("p-2 rounded-lg", link.bgColor)}>
                    <link.icon className={cn("h-5 w-5", link.color)} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white group-hover:text-primary transition-colors">
                      {link.title}
                    </p>
                    <p className="text-xs text-zinc-500">{link.description}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-zinc-400 group-hover:text-primary transition-colors" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Recent Orders */}
      <BlurFade delay={0.5}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-900 dark:text-white">Son Siparişler</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
              <Link href="/yonetim/siparisler/tum-siparisler">
                Tümünü Gör
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left pb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Müşteri</th>
                    <th className="text-left pb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Ürün/Hizmet</th>
                    <th className="text-left pb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Kategori</th>
                    <th className="text-left pb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Tutar</th>
                    <th className="text-left pb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                    <th className="text-right pb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">İncele</th>
                  </tr>
                </thead>
                <tbody>
                  {recentResult.data.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="py-3">
                        <Link
                          href={`/yonetim/musteriler/${order.customer.id}`}
                          className="text-sm text-zinc-900 dark:text-white hover:text-primary"
                        >
                          {order.customer.name} {order.customer.surname}
                        </Link>
                      </td>
                      <td className="py-3">
                        <span className="text-sm text-zinc-900 dark:text-white">{order.product.name}</span>
                      </td>
                      <td className="py-3">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">{order.product.category?.name ?? order.product.sku}</span>
                      </td>
                      <td className="py-3">
                        <span className="text-sm font-medium text-zinc-900 dark:text-white">
                          {formatPrice(Number(order.totalAmount))}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={cn(
                          "inline-flex px-2 py-0.5 rounded text-xs font-medium",
                          statusConfig[order.status]?.color ?? "bg-zinc-500/10 text-zinc-500"
                        )}>
                          {statusConfig[order.status]?.label ?? order.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/yonetim/siparisler/${order.id}`}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                        >
                          <Search className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {recentResult.data.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-zinc-500">
                        Henüz sipariş bulunmuyor
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
