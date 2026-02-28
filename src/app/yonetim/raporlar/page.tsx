import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Package,
  Headphones,
  BarChart3,
  PieChart,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import { getRevenueReport, getCustomerReport, getServiceReport } from "@/lib/dal/reports";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { PeriodFilter } from "./period-filter";
import { ReportExportButton } from "./report-export-button";

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(price);
};

// Hizmet renk paleti
const serviceColors = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-yellow-500",
  "bg-red-500",
];

const reportPeriods = ["7days", "30days", "3months", "6months", "1year"] as const;
type ReportPeriod = (typeof reportPeriods)[number];

const monthNames = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function parseReportPeriod(value: string | string[] | undefined): ReportPeriod {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && reportPeriods.includes(raw as ReportPeriod)) {
    return raw as ReportPeriod;
  }
  return "6months";
}

function getRangeByPeriod(period: ReportPeriod, now: Date) {
  const to = new Date(now);
  const from = new Date(now);

  if (period === "7days") {
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }

  if (period === "30days") {
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }

  if (period === "3months") {
    return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1), to };
  }

  if (period === "1year") {
    return { from: new Date(now.getFullYear(), now.getMonth() - 11, 1), to };
  }

  return { from: new Date(now.getFullYear(), now.getMonth() - 5, 1), to };
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildRevenueChartData(
  paidInvoices: Array<{ paidAt: Date | null; paidAmount: number }>,
  period: ReportPeriod,
  now: Date
) {
  if (period === "7days" || period === "30days") {
    const dayCount = period === "7days" ? 7 : 30;
    const revenueByDay = new Map<string, number>();

    for (const invoice of paidInvoices) {
      if (!invoice.paidAt) continue;
      const key = dayKey(new Date(invoice.paidAt));
      revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(invoice.paidAmount));
    }

    const points = [];
    for (let i = dayCount - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = dayKey(date);
      const label =
        dayCount <= 7
          ? `${String(date.getDate()).padStart(2, "0")} ${monthNames[date.getMonth()]}`
          : `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;

      points.push({
        key,
        month: label,
        revenue: revenueByDay.get(key) ?? 0,
      });
    }

    return {
      title: period === "7days" ? "Son 7 Gün Gelir Grafiği" : "Son 30 Gün Gelir Grafiği",
      points,
    };
  }

  const monthCount = period === "3months" ? 3 : period === "1year" ? 12 : 6;
  const revenueByMonth = new Map<string, number>();

  for (const invoice of paidInvoices) {
    if (!invoice.paidAt) continue;
    const key = monthKey(new Date(invoice.paidAt));
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + Number(invoice.paidAmount));
  }

  const points = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(date);
    const label =
      monthCount === 12
        ? `${monthNames[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`
        : monthNames[date.getMonth()];

    points.push({
      key,
      month: label,
      revenue: revenueByMonth.get(key) ?? 0,
    });
  }

  return {
    title:
      period === "3months"
        ? "Son 3 Ay Gelir Grafiği"
        : period === "1year"
          ? "Son 1 Yıl Gelir Grafiği"
          : "Son 6 Ay Gelir Grafiği",
    points,
  };
}

function periodLabel(period: ReportPeriod) {
  if (period === "7days") return "Son 7 Gün";
  if (period === "30days") return "Son 30 Gün";
  if (period === "3months") return "Son 3 Ay";
  if (period === "1year") return "Son 1 Yıl";
  return "Son 6 Ay";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const period = parseReportPeriod(sp.period);
  const now = new Date();
  const dateRange = getRangeByPeriod(period, now);

  const [revenueData, customerData, serviceData] = await Promise.all([
    getRevenueReport(dateRange),
    getCustomerReport(dateRange),
    getServiceReport(dateRange),
  ]);

  const chart = buildRevenueChartData(revenueData.paidInvoices, period, now);
  const monthlyData = chart.points;

  const maxRevenue = Math.max(...monthlyData.map((d) => d.revenue), 1);

  // Hizmet dagilimi: servicesByStatus'u kullan
  const totalActiveServices = serviceData.servicesByStatus.find((s) => s.status === "ACTIVE")?._count.id ?? 0;
  const totalSuspendedServices = serviceData.servicesByStatus.find((s) => s.status === "SUSPENDED")?._count.id ?? 0;
  const totalCancelledServices = serviceData.servicesByStatus.find((s) => s.status === "CANCELLED")?._count.id ?? 0;
  const totalExpiredServices = serviceData.servicesByStatus.find((s) => s.status === "EXPIRED")?._count.id ?? 0;

  const totalRevenueNum = Number(revenueData.totalRevenue);
  const avgInvoiceNum = Number(revenueData.avgInvoiceAmount);
  const monthlyRecurringNum = Number(serviceData.monthlyRecurring);

  // Inactive musteri orani
  const inactiveCustomers = customerData.totalCustomers - customerData.activeCustomers;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Raporlar</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              İş performansınızı analiz edin ve detaylı raporlar görüntüleyin
            </p>
          </div>
          <ReportExportButton period={period} />
        </div>
      </BlurFade>

      {/* Period Filter */}
      <BlurFade delay={0.05}>
        <PeriodFilter currentPeriod={period} />
      </BlurFade>

      <BlurFade delay={0.1}>
      <Tabs defaultValue="revenue" className="w-full">
        <TabsList className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-1">
          <TabsTrigger
            value="revenue"
            className="data-[state=active]:bg-white data-[state=active]:dark:bg-zinc-800 data-[state=active]:shadow-sm"
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Gelir
          </TabsTrigger>
          <TabsTrigger
            value="customers"
            className="data-[state=active]:bg-white data-[state=active]:dark:bg-zinc-800 data-[state=active]:shadow-sm"
          >
            <Users className="mr-2 h-4 w-4" />
            Müşteriler
          </TabsTrigger>
          <TabsTrigger
            value="services"
            className="data-[state=active]:bg-white data-[state=active]:dark:bg-zinc-800 data-[state=active]:shadow-sm"
          >
            <Package className="mr-2 h-4 w-4" />
            Hizmetler
          </TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="mt-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-lg bg-green-500/10">
                    <DollarSign className="h-6 w-6 text-green-500" />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Toplam Gelir</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{formatPrice(totalRevenueNum)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-lg bg-blue-500/10">
                    <BarChart3 className="h-6 w-6 text-blue-500" />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Fatura Sayısı</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{revenueData.invoiceCount.toLocaleString("tr-TR")}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-lg bg-purple-500/10">
                    <FileText className="h-6 w-6 text-purple-500" />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Ort. Fatura Tutarı</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{formatPrice(avgInvoiceNum)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-lg bg-orange-500/10">
                    <TrendingUp className="h-6 w-6 text-orange-500" />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Aylık Tekrarlayan Gelir</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{formatPrice(monthlyRecurringNum)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Chart */}
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-900 dark:text-white">{chart.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4 h-64">
                {monthlyData.map((data) => (
                  <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex gap-1 items-end" style={{ height: "200px" }}>
                      <div
                        className="flex-1 bg-primary rounded-t hover:bg-primary/80 transition-colors relative group"
                        style={{ height: `${(data.revenue / maxRevenue) * 100}%` }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {formatPrice(data.revenue)}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500">{data.month}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-primary" />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Gelir</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardContent className="p-4">
                <Users className="h-5 w-5 text-zinc-500 mb-2" />
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{customerData.totalCustomers.toLocaleString("tr-TR")}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Toplam Müşteri</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardContent className="p-4">
                <TrendingUp className="h-5 w-5 text-green-500 mb-2" />
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">+{customerData.newInPeriod.toLocaleString("tr-TR")}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{periodLabel(period)} yeni kayıt</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardContent className="p-4">
                <TrendingDown className="h-5 w-5 text-red-500 mb-2" />
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{inactiveCustomers.toLocaleString("tr-TR")}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Pasif Müşteri</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white">Müşteri Metrikleri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Aktif Müşteri</span>
                  <span className="text-sm font-medium text-green-500">{customerData.activeCustomers.toLocaleString("tr-TR")}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{periodLabel(period)} yeni</span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">+{customerData.newInPeriod.toLocaleString("tr-TR")}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Toplam Müşteri</span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">{customerData.totalCustomers.toLocaleString("tr-TR")}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white">Müşteri Türleri</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {customerData.customersByType.map((item) => {
                    const percentage = customerData.totalCustomers > 0
                      ? Math.round((item._count.id / customerData.totalCustomers) * 100)
                      : 0;
                    const label = item.customerType === "INDIVIDUAL" ? "Bireysel" : "Kurumsal";
                    return (
                      <div key={item.customerType ?? "unknown"}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">{percentage}%</span>
                        </div>
                        <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white">Hizmet Durumları</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {serviceData.servicesByStatus.map((service, index) => {
                    const percentage = serviceData.totalServices > 0
                      ? Math.round((service._count.id / serviceData.totalServices) * 100)
                      : 0;
                    const statusLabels: Record<string, string> = {
                      ACTIVE: "Aktif",
                      SUSPENDED: "Askıya Alınmış",
                      CANCELLED: "İptal",
                      EXPIRED: "Süresi Dolmuş",
                    };
                    return (
                      <div key={service.status}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={cn("h-3 w-3 rounded", serviceColors[index % serviceColors.length])} />
                            <span className="text-sm text-zinc-700 dark:text-zinc-300">
                              {statusLabels[service.status] ?? service.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">{service._count.id.toLocaleString("tr-TR")}</span>
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">{percentage}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", serviceColors[index % serviceColors.length])}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white">Hizmet İstatistikleri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Toplam Hizmet</span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">{serviceData.totalServices.toLocaleString("tr-TR")}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Aktif Hizmet</span>
                  <span className="text-sm font-medium text-green-500">{totalActiveServices.toLocaleString("tr-TR")}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Aylık Tekrarlayan Gelir</span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">{formatPrice(monthlyRecurringNum)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Süresi Yaklaşan</span>
                  <span className="text-sm font-medium text-red-500">{serviceData.expiringServices.length.toLocaleString("tr-TR")}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      </BlurFade>
    </div>
  );
}
