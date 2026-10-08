import type { Metadata } from "next";
import {
  Banknote,
  Calculator,
  FileText,
  Package,
  Receipt,
  Repeat,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartCard,
  DetailList,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  enumLabel,
  getStatusMeta,
} from "@/components/app";
import { BreakdownBars, StackedShareBar } from "@/components/admin-b/raporlar/breakdown";
import { LedgerTable, TaxBreakdownTable } from "@/components/admin-b/raporlar/accounting-tables";
import { formatTRY } from "@/lib/format/price";
import {
  getRevenueReport,
  getCustomerReport,
  getServiceReport,
  getAccountingReport,
} from "@/lib/dal/reports";
import type { PaymentMethod } from "@prisma/client";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { PeriodFilter } from "./period-filter";
import { ReportExportButton } from "./report-export-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Raporlar" };

const formatPrice = (price: number) => formatTRY(price, { keepDecimals: true });
const count = (n: number) => n.toLocaleString("tr-TR");

const tabTrigger =
  "-mb-px h-11 shrink-0 gap-2 rounded-none border-b-2 border-transparent px-3 text-sm text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none md:h-10 [&_svg]:size-4";

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

  const [revenueData, customerData, serviceData, accountingData] = await Promise.all([
    getRevenueReport(dateRange),
    getCustomerReport(dateRange),
    getServiceReport(dateRange),
    getAccountingReport(dateRange),
  ]);

  const chart = buildRevenueChartData(revenueData.paidInvoices, period, now);
  const chartData = chart.points.map((p) => ({ label: p.month, value: p.revenue }));
  const chartTotal = chart.points.reduce((sum, p) => sum + p.revenue, 0);

  const totalActiveServices = serviceData.servicesByStatus.find((s) => s.status === "ACTIVE")?._count.id ?? 0;

  const totalRevenueNum = Number(revenueData.totalRevenue);
  const avgInvoiceNum = Number(revenueData.avgInvoiceAmount);
  const monthlyRecurringNum = Number(serviceData.monthlyRecurring);

  const inactiveCustomers = customerData.totalCustomers - customerData.activeCustomers;

  const accountingSummary = accountingData.summary;
  const paymentMethodItems = (
    Object.entries(accountingSummary.collectedByMethod) as Array<[PaymentMethod, number]>
  ).map(([method, amount]) => ({
    key: method,
    label: enumLabel("paymentMethod", method),
    value: amount,
    display: formatPrice(amount),
  }));

  const customerTypeItems = customerData.customersByType.map((item) => ({
    key: item.customerType ?? "unknown",
    label: item.customerType ? enumLabel("customerType", item.customerType) : "Belirtilmemiş",
    value: item._count.id,
  }));

  const serviceStatusItems = [...serviceData.servicesByStatus]
    .sort((a, b) => b._count.id - a._count.id)
    .map((service) => {
      const meta = getStatusMeta("service", service.status);
      return { key: service.status, label: meta.label, value: service._count.id, tone: meta.tone };
    });

  const taxRows = accountingData.taxBreakdown.map((row) => ({
    month: row.month,
    label: row.label,
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
  }));

  const ledgerRows = accountingData.ledgerPreview.map((entry, index) => ({
    key: `${entry.invoiceNumber}-${entry.date.toISOString()}-${index}`,
    date: entry.date.toISOString(),
    invoiceNumber: entry.invoiceNumber,
    customerName: entry.customerName,
    subtotal: entry.subtotal,
    taxAmount: entry.taxAmount,
    totalAmount: entry.totalAmount,
    paymentMethod: entry.paymentMethod,
  }));

  const label = periodLabel(period);

  return (
    <>
      <PageHeader
        title="Raporlar"
        description="Gelir, müşteri, hizmet ve muhasebe verilerini seçtiğiniz döneme göre inceleyin."
        meta={<span className="font-mono text-[11px] uppercase tracking-[0.12em]">Dönem · {label}</span>}
        actions={<ReportExportButton period={period} />}
      />

      <PeriodFilter currentPeriod={period} />

      <Tabs defaultValue="revenue" className="w-full space-y-6">
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0 [scrollbar-width:none]">
          <TabsTrigger value="revenue" className={tabTrigger}>
            <Banknote aria-hidden />
            Gelir
          </TabsTrigger>
          <TabsTrigger value="customers" className={tabTrigger}>
            <Users aria-hidden />
            Müşteriler
          </TabsTrigger>
          <TabsTrigger value="services" className={tabTrigger}>
            <Package aria-hidden />
            Hizmetler
          </TabsTrigger>
          <TabsTrigger value="accounting" className={tabTrigger}>
            <Calculator aria-hidden />
            Muhasebe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-0 space-y-6">
          <StatGrid columns={4}>
            <StatCard label="Toplam gelir" value={formatPrice(totalRevenueNum)} icon={Wallet} hint={label} />
            <StatCard label="Fatura sayısı" value={count(revenueData.invoiceCount)} icon={FileText} hint="Dönemde ödenen" />
            <StatCard label="Ort. fatura" value={formatPrice(avgInvoiceNum)} icon={Receipt} hint="Ödenen fatura başına" />
            <StatCard label="Aylık tekrarlayan" value={formatPrice(monthlyRecurringNum)} icon={Repeat} hint="Aktif hizmet tutarlarının toplamı" />
          </StatGrid>

          <ChartCard
            title={chart.title}
            description={`Dönem toplamı ${formatPrice(chartTotal)} · ödeme tarihine göre`}
            data={chartData}
            formatValue={formatPrice}
            height={220}
            emptyText="Seçilen dönemde ödenmiş fatura yok."
          />
        </TabsContent>

        <TabsContent value="customers" className="mt-0 space-y-6">
          <StatGrid columns={3} className="grid-cols-1 sm:grid-cols-3">
            <StatCard label="Toplam müşteri" value={count(customerData.totalCustomers)} icon={Users} />
            <StatCard label="Yeni kayıt" value={`+${count(customerData.newInPeriod)}`} icon={UserPlus} hint={label} />
            <StatCard label="Pasif müşteri" value={count(inactiveCustomers)} icon={UserMinus} hint="Aktif olmayan hesaplar" />
          </StatGrid>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <SectionCard title="Müşteri metrikleri">
              <DetailList
                items={[
                  { label: "Aktif müşteri", value: count(customerData.activeCustomers) },
                  { label: `${label} yeni`, value: `+${count(customerData.newInPeriod)}` },
                  { label: "Pasif müşteri", value: count(inactiveCustomers) },
                  { label: "Toplam müşteri", value: count(customerData.totalCustomers) },
                ]}
              />
            </SectionCard>
            <SectionCard title="Müşteri türleri" description="Bireysel ve kurumsal hesap dağılımı">
              <BreakdownBars items={customerTypeItems} total={customerData.totalCustomers} emptyText="Henüz müşteri yok." />
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="services" className="mt-0 space-y-6">
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <SectionCard title="Hizmet durumları" description={`Toplam ${count(serviceData.totalServices)} hizmet`}>
              <StackedShareBar items={serviceStatusItems} emptyText="Henüz hizmet yok." />
            </SectionCard>
            <SectionCard title="Hizmet istatistikleri">
              <DetailList
                items={[
                  { label: "Toplam hizmet", value: count(serviceData.totalServices) },
                  { label: "Aktif hizmet", value: count(totalActiveServices) },
                  { label: "Aylık tekrarlayan gelir", value: formatPrice(monthlyRecurringNum) },
                  { label: "30 gün içinde sona erecek", value: count(serviceData.expiringServices.length) },
                ]}
              />
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="accounting" className="mt-0 space-y-6">
          <StatGrid columns={4}>
            <StatCard label="Brüt gelir" value={formatPrice(accountingSummary.grossRevenue)} icon={Wallet} />
            <StatCard label="KDV toplamı" value={formatPrice(accountingSummary.totalTax)} icon={Receipt} />
            <StatCard label="Net gelir" value={formatPrice(accountingSummary.netRevenue)} icon={TrendingUp} />
            <StatCard
              label="Tahsil edilecek"
              value={formatPrice(accountingSummary.outstanding)}
              icon={FileText}
              hint={`${accountingSummary.pendingCount} bekleyen, ${accountingSummary.overdueCount} gecikmiş`}
              tone={accountingSummary.overdueCount > 0 ? "danger" : accountingSummary.pendingCount > 0 ? "warning" : undefined}
            />
          </StatGrid>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <SectionCard title="Ödeme yöntemi dağılımı" description="Dönemde tahsil edilen tutarlar">
              <BreakdownBars items={paymentMethodItems} emptyText="Seçilen dönemde tahsilat yok." />
            </SectionCard>
            <SectionCard title="Aylık KDV dağılımı" flush>
              <TaxBreakdownTable rows={taxRows} />
            </SectionCard>
          </div>

          <SectionCard title="Son defter kayıtları" description="Dönemdeki en yeni 20 kayıt" flush>
            <LedgerTable rows={ledgerRows} />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </>
  );
}
