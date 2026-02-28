import Link from "next/link";
import {
  TrendingUp,
  Headphones,
  ArrowUpRight,
  DollarSign,
  UserPlus,
  ShoppingCart,
  FileWarning,
  CalendarClock,
  Bell,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import { getAdminDashboardStats } from "@/lib/dal/dashboard";

const orderStatusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Beklemede", color: "bg-yellow-500/10 text-yellow-500" },
  APPROVED: { label: "Onaylandı", color: "bg-blue-500/10 text-blue-500" },
  PROCESSING: { label: "İşleniyor", color: "bg-blue-500/10 text-blue-500" },
  COMPLETED: { label: "Tamamlandı", color: "bg-green-500/10 text-green-500" },
  CANCELLED: { label: "İptal", color: "bg-red-500/10 text-red-500" },
  REFUNDED: { label: "İade", color: "bg-zinc-500/10 text-zinc-500" },
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(price);
};

export default async function AdminDashboard() {
  const data = await getAdminDashboardStats();

  const stats = [
    {
      title: "Toplam Gelir",
      value: formatPrice(Number(data.totalRevenue)),
      description: `Bu ay: ${formatPrice(Number(data.monthlyRevenue))}`,
      icon: DollarSign,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      href: "/yonetim/faturalar",
    },
    {
      title: "Aylık Gelir",
      value: formatPrice(Number(data.monthlyRevenue)),
      description: `Toplam sipariş: ${data.totalOrders.toLocaleString("tr-TR")}`,
      icon: TrendingUp,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      href: "/yonetim/raporlar",
    },
    {
      title: "Yeni Müşteri (Bu Ay)",
      value: data.newCustomersThisMonth.toLocaleString("tr-TR"),
      description: `Toplam: ${data.totalCustomers.toLocaleString("tr-TR")} müşteri`,
      icon: UserPlus,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      href: "/yonetim/musteriler",
    },
    {
      title: "Bekleyen Destek",
      value: data.pendingTickets.toLocaleString("tr-TR"),
      description: `${data.activeServices.toLocaleString("tr-TR")} aktif hizmet`,
      icon: Headphones,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      href: "/yonetim/destek",
    },
  ];

  const middleStats = [
    {
      title: "Toplam Sipariş",
      value: data.totalOrders.toLocaleString("tr-TR"),
      description: `${data.totalCustomers.toLocaleString("tr-TR")} müşteri`,
      icon: ShoppingCart,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      href: "/yonetim/siparisler",
    },
    {
      title: "Aktif Hizmet",
      value: data.activeServices.toLocaleString("tr-TR"),
      description: "Aktif servisler",
      icon: CalendarClock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      href: "/yonetim/hizmetler",
    },
    {
      title: "Toplam Müşteri",
      value: data.totalCustomers.toLocaleString("tr-TR"),
      description: `Bu ay: +${data.newCustomersThisMonth.toLocaleString("tr-TR")}`,
      icon: FileWarning,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      href: "/yonetim/musteriler",
    },
    {
      title: "Bekleyen Fatura",
      value: data.upcomingInvoices.length.toLocaleString("tr-TR"),
      description: "Yaklaşan ödemeler",
      icon: Bell,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      href: "/yonetim/faturalar?durum=upcoming",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Hoş geldin, Admin. İşte bugünkü genel bakış.</p>
        </div>
      </BlurFade>

      {/* Top Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
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

      {/* Middle Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {middleStats.map((stat, index) => (
          <BlurFade key={stat.title} delay={0.5 + index * 0.05}>
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

      {/* Recent Orders */}
      <BlurFade delay={0.7}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-900 dark:text-white">Son Siparişler</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
              <Link href="/yonetim/siparisler">
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
                    <th className="text-left pb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Sipariş No</th>
                    <th className="text-left pb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Tarih</th>
                    <th className="text-left pb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Tutar</th>
                    <th className="text-left pb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                    <th className="text-right pb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">İncele</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentOrders.map((order) => {
                    const statusConf = orderStatusConfig[order.status] ?? {
                      label: order.status,
                      color: "bg-zinc-500/10 text-zinc-500",
                    };
                    return (
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
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">{order.orderNumber}</span>
                        </td>
                        <td className="py-3">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {new Date(order.createdAt).toLocaleDateString("tr-TR")}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">
                            {formatPrice(order.totalAmount)}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={cn(
                            "inline-flex px-2 py-0.5 rounded text-xs font-medium",
                            statusConf.color
                          )}>
                            {statusConf.label}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Upcoming Due Invoices */}
      <BlurFade delay={0.8}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-zinc-900 dark:text-white">Ödeme Tarihi Yaklaşan Faturalar</CardTitle>
              <p className="text-sm text-zinc-500 mt-1">Yaklaşan ödenmemiş faturalar</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
              <Link href="/yonetim/faturalar?durum=upcoming">
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
                    <th className="text-left pb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Fatura No</th>
                    <th className="text-left pb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Son Ödeme</th>
                    <th className="text-left pb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Tutar</th>
                    <th className="text-left pb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Kalan</th>
                    <th className="text-right pb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">İncele</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcomingInvoices.map((invoice) => {
                    const daysLeft = Math.max(
                      0,
                      Math.ceil(
                        (new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      )
                    );
                    return (
                      <tr
                        key={invoice.id}
                        className="border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <td className="py-3">
                          <Link
                            href={`/yonetim/musteriler/${invoice.customer.id}`}
                            className="text-sm text-zinc-900 dark:text-white hover:text-primary"
                          >
                            {invoice.customer.name} {invoice.customer.surname}
                          </Link>
                        </td>
                        <td className="py-3">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">{invoice.invoiceNumber}</span>
                        </td>
                        <td className="py-3">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {new Date(invoice.dueDate).toLocaleDateString("tr-TR")}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">
                            {formatPrice(invoice.totalAmount)}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={cn(
                            "inline-flex px-2 py-0.5 rounded text-xs font-medium",
                            daysLeft <= 2 ? "bg-red-500/10 text-red-500" :
                            daysLeft <= 4 ? "bg-yellow-500/10 text-yellow-500" :
                            "bg-zinc-500/10 text-zinc-500"
                          )}>
                            {daysLeft} gün
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            href={`/yonetim/faturalar/${invoice.id}`}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                          >
                            <Search className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
