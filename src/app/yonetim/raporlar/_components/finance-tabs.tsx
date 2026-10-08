import { AlertTriangle, Percent, Repeat, TrendingDown, Users, Wallet } from "lucide-react";
import { ChartCard, SectionCard, StatCard, StatGrid, enumLabel } from "@/components/app";
import { formatTRY } from "@/lib/format/price";
import { toNumber, toNumberOrNull } from "@/lib/money";
import { DOMAIN_SALE_LABELS, getDomainMarginReport } from "@/lib/reports/domain-margin";
import { getCollections, getReceivablesAging, getRevenueByCategory, getRevenueByMethod } from "@/lib/reports/finance";
import { getEInvoiceMismatches, getKdvReport, getUnissuedPaidInvoices, type KdvMonthRow } from "@/lib/reports/kdv";
import { getMrrReport } from "@/lib/reports/mrr";
import { dayLabel, monthLabel, type ReportRange } from "@/lib/reports/range";
import { CsvLink } from "./csv-link";
import { ReportTable, type ReportRow } from "./report-table";

const tl = (n: number) => formatTRY(n, { keepDecimals: true });
const num = (value: { toString(): string } | null) => (value === null ? null : Number(value.toString()));
const istanbulDateTime = (date: Date) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(date);

interface TabProps {
  range: ReportRange;
  query: string;
}

/** Category + payment method tables under the existing revenue overview. */
export async function RevenueBreakdowns({ range, query }: TabProps) {
  const [categories, methods] = await Promise.all([getRevenueByCategory(range), getRevenueByMethod(range)]);
  const totalNet = categories.reduce((acc, r) => acc + toNumber(r.net), 0);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <SectionCard
        title="Kategoriye göre gelir"
        description="Dönemde ödenen faturalar, KDV hariç"
        actions={<CsvLink table="revenue-category" query={query} />}
        flush
      >
        <ReportTable
          caption="Kategoriye göre gelir"
          columns={[
            { key: "label", header: "Kategori" },
            { key: "invoices", header: "Fatura", kind: "int" },
            { key: "net", header: "Net", kind: "money", strong: true },
            { key: "share", header: "Pay", kind: "pct" },
            { key: "gross", header: "KDV dahil", kind: "money" },
          ]}
          rows={categories.map((r) => ({
            id: r.category,
            label: r.label,
            invoices: r.invoices,
            net: toNumber(r.net),
            share: totalNet > 0 ? Math.round((toNumber(r.net) / totalNet) * 1000) / 10 : null,
            gross: toNumber(r.gross),
          }))}
          trailing="net"
        />
      </SectionCard>
      <SectionCard
        title="Ödeme yöntemine göre tahsilat"
        description="Dönemde alınan ödemeler (sonradan iade edilenler dahil)"
        actions={<CsvLink table="revenue-method" query={query} />}
        flush
      >
        <ReportTable
          caption="Ödeme yöntemine göre tahsilat"
          columns={[
            { key: "label", header: "Yöntem" },
            { key: "payments", header: "Ödeme", kind: "int" },
            { key: "amount", header: "Tutar", kind: "money", strong: true },
          ]}
          rows={methods.map((r) => ({
            id: r.method,
            label: enumLabel("paymentMethod", r.method),
            payments: r.payments,
            amount: toNumber(r.amount),
          }))}
          trailing="amount"
        />
      </SectionCard>
    </div>
  );
}

export async function MrrTab({ range, query }: TabProps) {
  const report = await getMrrReport(range);
  const last = report.months.at(-1);

  return (
    <>
      <StatGrid columns={4}>
        <StatCard label="MRR" value={tl(toNumber(report.current.mrr))} icon={Repeat} hint={`${report.current.services} aktif hizmet`} />
        <StatCard label="ARR" value={tl(toNumber(report.current.arr))} icon={Wallet} hint="MRR × 12" />
        <StatCard
          label="ARPU"
          value={report.current.arpu ? tl(toNumber(report.current.arpu)) : "—"}
          icon={Users}
          hint={`${report.current.customers} ödeyen müşteri`}
        />
        <StatCard
          label="Son ay churn"
          value={last?.logoChurnRate ? `%${num(last.logoChurnRate)!.toLocaleString("tr-TR")}` : "—"}
          icon={TrendingDown}
          hint={last?.revenueChurnRate ? `Gelir churn %${num(last.revenueChurnRate)!.toLocaleString("tr-TR")}` : "Müşteri bazında"}
        />
      </StatGrid>

      <ChartCard
        title="Ay sonu MRR"
        description="Aktif tekrarlayan hizmetlerin aylık karşılığı (yıllık ÷ 12), KDV hariç"
        data={report.months.map((m) => ({ label: monthLabel(m.month, true), value: toNumber(m.endMrr) }))}
        formatValue={tl}
        height={200}
        emptyText="Seçilen dönemde tekrarlayan hizmet yok."
      />

      <SectionCard
        title="Aylık MRR hareketi"
        description="Yeni ve kaybedilen MRR, müşteri (logo) ve gelir churn oranı. Askıya alınan hizmet kayıp sayılır."
        actions={<CsvLink table="mrr" query={query} />}
        flush
      >
        <ReportTable
          caption="Aylık MRR hareketi"
          columns={[
            { key: "month", header: "Ay" },
            { key: "startMrr", header: "Ay başı", kind: "money" },
            { key: "newMrr", header: "Yeni", kind: "money" },
            { key: "churnedMrr", header: "Kayıp", kind: "money" },
            { key: "endMrr", header: "Ay sonu", kind: "money", strong: true },
            { key: "customers", header: "Müşteri", kind: "int" },
            { key: "logoChurn", header: "Müşteri churn", kind: "pct" },
            { key: "revenueChurn", header: "Gelir churn", kind: "pct" },
            { key: "arpu", header: "ARPU", kind: "money" },
          ]}
          rows={[...report.months].reverse().map((m) => ({
            id: m.month,
            month: monthLabel(m.month),
            startMrr: toNumber(m.startMrr),
            newMrr: toNumber(m.newMrr),
            churnedMrr: toNumber(m.churnedMrr),
            endMrr: toNumber(m.endMrr),
            customers: m.endCustomers,
            logoChurn: num(m.logoChurnRate),
            revenueChurn: num(m.revenueChurnRate),
            arpu: toNumberOrNull(m.arpu),
          }))}
          trailing="endMrr"
        />
      </SectionCard>
    </>
  );
}

export async function CollectionsTab({ range, query }: TabProps) {
  const [collections, aging] = await Promise.all([getCollections(range), getReceivablesAging()]);
  const label = (key: string) => (collections.granularity === "day" ? dayLabel(key, true) : monthLabel(key, true));
  const totals = collections.rows.reduce(
    (acc, r) => ({ collected: acc.collected + toNumber(r.collected), refunded: acc.refunded + toNumber(r.refunded) }),
    { collected: 0, refunded: 0 }
  );
  const outstanding = aging.reduce((acc, r) => acc + toNumber(r.outstanding), 0);
  const overdue = aging.filter((r) => r.bucket !== "current").reduce((acc, r) => acc + toNumber(r.outstanding), 0);

  return (
    <>
      <StatGrid columns={4}>
        <StatCard label="Tahsil edilen" value={tl(totals.collected)} icon={Wallet} />
        <StatCard label="İade edilen" value={tl(totals.refunded)} icon={TrendingDown} />
        <StatCard label="Açık alacak" value={tl(outstanding)} icon={Percent} hint="Bugün itibarıyla" />
        <StatCard
          label="Vadesi geçmiş"
          value={tl(overdue)}
          icon={AlertTriangle}
          tone={overdue > 0 ? "danger" : undefined}
          hint="Vade tarihine göre"
        />
      </StatGrid>

      <ChartCard
        title={collections.granularity === "day" ? "Günlük tahsilat" : "Aylık tahsilat"}
        description="Tamamlanan ödemeler, ödeme tarihine göre"
        data={collections.rows.map((r) => ({ label: label(r.key), value: toNumber(r.collected) }))}
        formatValue={tl}
        height={200}
        emptyText="Seçilen dönemde tahsilat yok."
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SectionCard title="Tahsilat dökümü" actions={<CsvLink table="collections" query={query} />} flush>
          <ReportTable
            caption="Tahsilat dökümü"
            columns={[
              { key: "label", header: collections.granularity === "day" ? "Gün" : "Ay" },
              { key: "payments", header: "Ödeme", kind: "int" },
              { key: "collected", header: "Tahsilat", kind: "money" },
              { key: "refunded", header: "İade", kind: "money" },
              { key: "net", header: "Net", kind: "money", strong: true },
            ]}
            rows={[...collections.rows]
              .filter((r) => !r.collected.isZero() || !r.refunded.isZero())
              .reverse()
              .map((r) => ({
                id: r.key,
                label: collections.granularity === "day" ? dayLabel(r.key) : monthLabel(r.key),
                payments: r.payments,
                collected: toNumber(r.collected),
                refunded: toNumber(r.refunded),
                net: toNumber(r.net),
              }))}
            trailing="net"
            pageSize={12}
          />
        </SectionCard>
        <SectionCard
          title="Alacak yaşlandırma"
          description="Ödenmemiş faturalar (bekleyen + gecikmiş), vade aşımına göre. Dönemden bağımsız."
          actions={<CsvLink table="aging" query={query} />}
          flush
        >
          <ReportTable
            caption="Alacak yaşlandırma"
            columns={[
              { key: "label", header: "Vade aşımı" },
              { key: "invoices", header: "Fatura", kind: "int" },
              { key: "outstanding", header: "Açık tutar", kind: "money", strong: true },
            ]}
            rows={aging.map((r) => ({ id: r.bucket, label: r.label, invoices: r.invoices, outstanding: toNumber(r.outstanding) }))}
            trailing="outstanding"
          />
        </SectionCard>
      </div>
    </>
  );
}

function kdvRow(r: KdvMonthRow, label: string): ReportRow {
  return {
    id: r.month,
    month: label,
    invoices: r.invoices,
    salesBase: toNumber(r.salesBase),
    salesTax: toNumber(r.salesTax),
    refundBase: toNumber(r.refundBase),
    refundTax: toNumber(r.refundTax),
    netBase: toNumber(r.netBase),
    netTax: toNumber(r.netTax),
  };
}

export async function KdvTab({ range, query }: TabProps) {
  const [kdv, unissued, mismatches] = await Promise.all([
    getKdvReport(range),
    getUnissuedPaidInvoices(range),
    getEInvoiceMismatches(range),
  ]);

  return (
    <>
      <StatGrid columns={4}>
        <StatCard label="Net matrah" value={tl(toNumber(kdv.total.netBase))} icon={Wallet} hint={`${kdv.total.invoices} fatura`} />
        <StatCard label="Hesaplanan KDV" value={tl(toNumber(kdv.total.netTax))} icon={Percent} hint="İadeler düşülmüş" />
        <StatCard
          label="E-belgesi eksik"
          value={unissued.length.toLocaleString("tr-TR")}
          icon={AlertTriangle}
          tone={unissued.length > 0 ? "warning" : "success"}
          hint="Ödenmiş, e-belge kesilmemiş"
        />
        <StatCard
          label="Tutar farkı"
          value={mismatches.length.toLocaleString("tr-TR")}
          icon={AlertTriangle}
          tone={mismatches.length > 0 ? "danger" : "success"}
          hint="Fatura ≠ e-belge toplamı"
        />
      </StatGrid>

      <ChartCard
        title="Aylık hesaplanan KDV"
        description="Ödeme tarihine göre satış KDV'si − aynı ayda yapılan iadelerin KDV'si"
        data={kdv.rows.map((r) => ({ label: monthLabel(r.month, true), value: toNumber(r.netTax) }))}
        formatValue={tl}
        height={180}
        emptyText="Seçilen dönemde KDV tahakkuku yok."
      />

      <SectionCard
        title="KDV tahakkuk"
        description="Satış: dönemde ödenen faturalar (sonradan iade edilse de ödeme ayında). İade: tamamlanan iadeler, iade ayında KDV dahil tutardan ayrıştırılarak düşülür."
        actions={<CsvLink table="kdv" query={query} />}
        flush
      >
        <ReportTable
          caption="KDV tahakkuk"
          columns={[
            { key: "month", header: "Ay" },
            { key: "invoices", header: "Fatura", kind: "int" },
            { key: "salesBase", header: "Satış matrahı", kind: "money" },
            { key: "salesTax", header: "Satış KDV", kind: "money" },
            { key: "refundBase", header: "İade matrahı", kind: "money" },
            { key: "refundTax", header: "İade KDV", kind: "money" },
            { key: "netBase", header: "Net matrah", kind: "money", strong: true },
            { key: "netTax", header: "Net KDV", kind: "money", strong: true },
          ]}
          rows={[...kdv.rows].reverse().map((r) => kdvRow(r, monthLabel(r.month)))}
          footer={kdvRow(kdv.total, "Toplam")}
          trailing="netTax"
        />
      </SectionCard>

      <SectionCard
        title="E-belgesi kesilmemiş ödenmiş faturalar"
        description="Ödenmiş ama gönderilmiş/onaylanmış e-Fatura veya e-Arşiv kaydı olmayan faturalar."
        actions={<CsvLink table="kdv-unissued" query={query} />}
        flush
      >
        <ReportTable
          caption="E-belgesi kesilmemiş ödenmiş faturalar"
          columns={[
            { key: "invoiceNumber", header: "Fatura", kind: "mono" },
            { key: "paidAt", header: "Ödeme" },
            { key: "customer", header: "Müşteri" },
            { key: "total", header: "Toplam", kind: "money", strong: true },
            { key: "status", header: "E-belge" },
          ]}
          rows={unissued.map((r) => ({
            id: r.id,
            invoiceNumber: r.invoiceNumber,
            paidAt: istanbulDateTime(r.paidAt),
            customer: r.customer,
            total: toNumber(r.total),
            status: r.eInvoiceStatus ?? "Kayıt yok",
          }))}
          trailing="total"
          pageSize={10}
          emptyText="Tüm ödenmiş faturaların e-belgesi kesilmiş."
        />
      </SectionCard>

      <SectionCard
        title="Tutarı farklı e-belgeler"
        description="Gönderilen belgenin ödenecek tutarı veya KDV'si faturadan farklı."
        actions={<CsvLink table="kdv-mismatch" query={query} />}
        flush
      >
        <ReportTable
          caption="Tutarı farklı e-belgeler"
          columns={[
            { key: "invoiceNumber", header: "Fatura", kind: "mono" },
            { key: "documentNumber", header: "Belge", kind: "mono" },
            { key: "invoiceTotal", header: "Fatura toplamı", kind: "money" },
            { key: "documentTotal", header: "Belge toplamı", kind: "money", strong: true },
            { key: "invoiceTax", header: "Fatura KDV", kind: "money" },
            { key: "documentTax", header: "Belge KDV", kind: "money" },
          ]}
          rows={mismatches.map((r) => ({
            id: r.id,
            invoiceNumber: r.invoiceNumber,
            documentNumber: r.documentNumber,
            invoiceTotal: toNumber(r.invoiceTotal),
            documentTotal: toNumber(r.documentTotal),
            invoiceTax: toNumber(r.invoiceTax),
            documentTax: toNumber(r.documentTax),
          }))}
          trailing="documentTotal"
          pageSize={10}
          emptyText="Tutarı farklı e-belge yok."
        />
      </SectionCard>
    </>
  );
}

const ISSUE_LABELS = { NO_TLD: "Uzantı yok", NO_COST: "Maliyet yok", NO_RATE: "Kur yok" } as const;

export async function DomainsTab({ range, query }: TabProps) {
  const { rows, summary, byTld } = await getDomainMarginReport(range);

  return (
    <>
      <StatGrid columns={4}>
        <StatCard label="Domain satışı" value={tl(toNumber(summary.revenue))} icon={Wallet} hint={`${summary.sales} işlem, KDV hariç`} />
        <StatCard label="Maliyet (TRY)" value={tl(toNumber(summary.cost))} icon={TrendingDown} hint="USD maliyet × satış günü kuru" />
        <StatCard
          label="Brüt kâr"
          value={tl(toNumber(summary.margin))}
          icon={Percent}
          hint={summary.marginPercent ? `Marj %${num(summary.marginPercent)!.toLocaleString("tr-TR")}` : "Marj hesaplanamadı"}
        />
        <StatCard
          label="Maliyetsiz işlem"
          value={summary.uncosted.toLocaleString("tr-TR")}
          icon={AlertTriangle}
          tone={summary.uncosted > 0 ? "warning" : undefined}
          hint="Kârdan hariç tutuldu"
        />
      </StatGrid>

      <SectionCard
        title="Uzantıya göre"
        description="Maliyet: TLD fiyatları ekranındaki güncel registrar maliyeti × ödeme günündeki TCMB döviz satış kuru (tatilde önceki iş günü)."
        flush
      >
        <ReportTable
          caption="Uzantıya göre domain kârı"
          columns={[
            { key: "tld", header: "Uzantı", kind: "mono" },
            { key: "sales", header: "İşlem", kind: "int" },
            { key: "revenue", header: "Satış", kind: "money" },
            { key: "cost", header: "Maliyet", kind: "money" },
            { key: "margin", header: "Brüt kâr", kind: "money", strong: true },
            { key: "marginPercent", header: "Marj", kind: "pct" },
          ]}
          rows={byTld.map((g) => ({
            id: g.tld,
            tld: g.tld,
            sales: g.sales,
            revenue: toNumber(g.revenue),
            cost: g.uncosted === g.sales ? null : toNumber(g.cost),
            margin: g.uncosted === g.sales ? null : toNumber(g.margin),
            marginPercent: num(g.marginPercent),
          }))}
          trailing="margin"
          emptyText="Seçilen dönemde domain satışı yok."
        />
      </SectionCard>

      <SectionCard title="İşlemler" actions={<CsvLink table="domain-margin" query={query} />} flush>
        <ReportTable
          caption="Domain işlemleri"
          columns={[
            { key: "domain", header: "Alan adı", kind: "mono" },
            { key: "kind", header: "İşlem" },
            { key: "paidAt", header: "Ödeme" },
            { key: "sale", header: "Satış", kind: "money" },
            { key: "cost", header: "Maliyet", kind: "text" },
            { key: "rate", header: "Kur", kind: "rate" },
            { key: "costTry", header: "Maliyet (₺)", kind: "money" },
            { key: "margin", header: "Brüt kâr", kind: "money", strong: true },
            { key: "note", header: "Not" },
          ]}
          rows={[...rows].reverse().map((r) => ({
            id: r.invoiceId,
            domain: r.domain || "—",
            kind: `${DOMAIN_SALE_LABELS[r.kind]}${r.years > 1 ? ` · ${r.years} yıl` : ""}`,
            paidAt: istanbulDateTime(r.paidAt),
            sale: toNumber(r.sale),
            cost: r.costForeign ? `${num(r.costForeign)!.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} ${r.costCurrency}` : null,
            rate: r.costCurrency === "TRY" ? null : num(r.rate),
            costTry: toNumberOrNull(r.costTry),
            margin: toNumberOrNull(r.margin),
            note: r.issue ? ISSUE_LABELS[r.issue] : r.rateDay && r.costCurrency !== "TRY" ? `Kur ${dayLabel(r.rateDay)}` : null,
          }))}
          trailing="margin"
          pageSize={15}
          emptyText="Seçilen dönemde domain satışı yok."
        />
      </SectionCard>
    </>
  );
}
