import type { Metadata } from "next";
import {
  FileText,
  Receipt,
  Repeat,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
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
import { sum, toNumber } from "@/lib/money";
import { parseReportRange, rangeSearchParams, toIstanbulDay, type ReportRange } from "@/lib/reports/range";
import { buildRevenueTrend, rangeLabel } from "@/lib/reports/revenue-trend";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { PeriodFilter } from "./period-filter";
import { ReportExportButton } from "./report-export-button";
import { ReportTabs, parseReportTab } from "./_components/report-tabs";
import { CollectionsTab, DomainsTab, KdvTab, MrrTab, RevenueBreakdowns } from "./_components/finance-tabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Raporlar" };

const formatPrice = (price: number) => formatTRY(price, { keepDecimals: true });
const count = (n: number) => n.toLocaleString("tr-TR");

interface LegacyTabProps {
  range: ReportRange;
  label: string;
}

async function RevenueOverview({ range, label }: LegacyTabProps) {
  const [revenueData, serviceData] = await Promise.all([getRevenueReport(range), getServiceReport(range)]);
  const trend = buildRevenueTrend(revenueData.paidInvoices, range);
  const chartData = trend.points.map((p) => ({ label: p.label, value: p.value }));
  const chartTotal = toNumber(sum(trend.points.map((p) => p.value)));

  return (
    <>
      <StatGrid columns={4}>
        <StatCard label="Toplam gelir" value={formatPrice(revenueData.totalRevenue)} icon={Wallet} hint={label} />
        <StatCard label="Fatura sayısı" value={count(revenueData.invoiceCount)} icon={FileText} hint="Dönemde ödenen" />
        <StatCard label="Ort. fatura" value={formatPrice(revenueData.avgInvoiceAmount)} icon={Receipt} hint="Ödenen fatura başına" />
        <StatCard label="Aylık tekrarlayan" value={formatPrice(serviceData.monthlyRecurring)} icon={Repeat} hint="Aktif hizmetlerin aylık karşılığı" />
      </StatGrid>

      <ChartCard
        title={trend.granularity === "day" ? "Günlük gelir" : "Aylık gelir"}
        description={`Dönem toplamı ${formatPrice(chartTotal)} · ödeme tarihine göre`}
        data={chartData}
        formatValue={formatPrice}
        height={220}
        emptyText="Seçilen dönemde ödenmiş fatura yok."
      />
    </>
  );
}

async function CustomersTab({ range, label }: LegacyTabProps) {
  const customerData = await getCustomerReport(range);
  const inactiveCustomers = customerData.totalCustomers - customerData.activeCustomers;
  const customerTypeItems = customerData.customersByType.map((item) => ({
    key: item.customerType ?? "unknown",
    label: item.customerType ? enumLabel("customerType", item.customerType) : "Belirtilmemiş",
    value: item._count.id,
  }));

  return (
    <>
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
    </>
  );
}

async function ServicesTab({ range }: LegacyTabProps) {
  const serviceData = await getServiceReport(range);
  const totalActiveServices = serviceData.servicesByStatus.find((s) => s.status === "ACTIVE")?._count.id ?? 0;
  const serviceStatusItems = [...serviceData.servicesByStatus]
    .sort((a, b) => b._count.id - a._count.id)
    .map((service) => {
      const meta = getStatusMeta("service", service.status);
      return { key: service.status, label: meta.label, value: service._count.id, tone: meta.tone };
    });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <SectionCard title="Hizmet durumları" description={`Toplam ${count(serviceData.totalServices)} hizmet`}>
        <StackedShareBar items={serviceStatusItems} emptyText="Henüz hizmet yok." />
      </SectionCard>
      <SectionCard title="Hizmet istatistikleri">
        <DetailList
          items={[
            { label: "Toplam hizmet", value: count(serviceData.totalServices) },
            { label: "Aktif hizmet", value: count(totalActiveServices) },
            { label: "Aylık tekrarlayan gelir", value: formatPrice(serviceData.monthlyRecurring) },
            { label: "30 gün içinde sona erecek", value: count(serviceData.expiringServices.length) },
          ]}
        />
      </SectionCard>
    </div>
  );
}

async function AccountingTab({ range }: LegacyTabProps) {
  const accountingData = await getAccountingReport(range);
  const accountingSummary = accountingData.summary;
  const paymentMethodItems = (
    Object.entries(accountingSummary.collectedByMethod) as Array<[PaymentMethod, number]>
  ).map(([method, amount]) => ({
    key: method,
    label: enumLabel("paymentMethod", method),
    value: amount,
    display: formatPrice(amount),
  }));
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

  return (
    <>
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
    </>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const now = new Date();
  const range = parseReportRange(sp, now);
  const tab = parseReportTab(sp.tab);
  const query = rangeSearchParams(range).toString();
  const label = rangeLabel(range);
  const props = { range, query, label };

  return (
    <>
      <PageHeader
        title="Raporlar"
        description="Gelir, MRR, tahsilat, KDV ve domain kârlılığını seçtiğiniz döneme göre inceleyin. Tutarlar TL; aksi belirtilmedikçe KDV hariç."
        meta={<span className="font-mono text-[11px] uppercase tracking-[0.12em]">Dönem · {label}</span>}
        actions={<ReportExportButton query={query} />}
      />

      <PeriodFilter
        key={query}
        currentPeriod={range.period}
        fromDay={range.fromDay}
        toDay={range.toDay}
        maxDay={toIstanbulDay(now)}
      />

      <ReportTabs active={tab} query={query} />

      {tab === "revenue" ? (
        <>
          <RevenueOverview {...props} />
          <RevenueBreakdowns {...props} />
        </>
      ) : null}
      {tab === "mrr" ? <MrrTab {...props} /> : null}
      {tab === "collections" ? <CollectionsTab {...props} /> : null}
      {tab === "kdv" ? <KdvTab {...props} /> : null}
      {tab === "domains" ? <DomainsTab {...props} /> : null}
      {tab === "customers" ? <CustomersTab {...props} /> : null}
      {tab === "services" ? <ServicesTab {...props} /> : null}
      {tab === "accounting" ? <AccountingTab {...props} /> : null}
    </>
  );
}
