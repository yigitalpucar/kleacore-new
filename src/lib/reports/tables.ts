/**
 * CSV definitions of the report tables on /yonetim/raporlar. Each table's
 * rows are built from the same loader the page renders, so the download
 * always matches the screen. Served by /api/admin/reports/csv?table=<key>.
 */
import { enumLabel } from "@/components/app/status-map";
import { csvAmount, type CsvAmount, type CsvCell } from "./csv";
import { DOMAIN_SALE_LABELS, getDomainMarginReport } from "./domain-margin";
import { getCollections, getReceivablesAging, getRevenueByCategory, getRevenueByMethod } from "./finance";
import { getEInvoiceMismatches, getKdvReport, getUnissuedPaidInvoices } from "./kdv";
import { getMrrReport } from "./mrr";
import { dayLabel, monthLabel, type ReportRange } from "./range";

type Row = Array<CsvCell | CsvAmount>;

export interface ReportTableDef {
  title: string;
  build(range: ReportRange): Promise<Row[]>;
}

const pct = (value: { toString(): string } | null) => (value === null ? "" : csvAmount(value.toString(), 2));
const istanbulDateTime = (date: Date) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(date);

export const REPORT_TABLES = {
  mrr: {
    title: "MRR ve churn",
    async build(range) {
      const report = await getMrrReport(range);
      return [
        ["Ay", "Ay başı MRR", "Yeni MRR", "Kaybedilen MRR", "Ay sonu MRR", "Ay başı müşteri", "Yeni müşteri", "Kaybedilen müşteri", "Ay sonu müşteri", "Müşteri churn %", "Gelir churn %", "ARPU"],
        ...report.months.map((m) => [
          monthLabel(m.month),
          csvAmount(m.startMrr),
          csvAmount(m.newMrr),
          csvAmount(m.churnedMrr),
          csvAmount(m.endMrr),
          m.startCustomers,
          m.newCustomers,
          m.churnedCustomers,
          m.endCustomers,
          pct(m.logoChurnRate),
          pct(m.revenueChurnRate),
          m.arpu === null ? "" : csvAmount(m.arpu),
        ]),
      ];
    },
  },
  "revenue-category": {
    title: "Kategoriye göre gelir",
    async build(range) {
      const rows = await getRevenueByCategory(range);
      return [
        ["Kategori", "Fatura", "Net (KDV hariç)", "KDV", "Toplam"],
        ...rows.map((r) => [r.label, r.invoices, csvAmount(r.net), csvAmount(r.tax), csvAmount(r.gross)]),
      ];
    },
  },
  "revenue-method": {
    title: "Ödeme yöntemine göre tahsilat",
    async build(range) {
      const rows = await getRevenueByMethod(range);
      return [
        ["Ödeme yöntemi", "Ödeme adedi", "Tutar"],
        ...rows.map((r) => [enumLabel("paymentMethod", r.method), r.payments, csvAmount(r.amount)]),
      ];
    },
  },
  collections: {
    title: "Tahsilatlar",
    async build(range) {
      const { granularity, rows } = await getCollections(range);
      return [
        [granularity === "day" ? "Gün" : "Ay", "Ödeme adedi", "Tahsil edilen", "İade edilen", "Net"],
        ...rows.map((r) => [
          granularity === "day" ? dayLabel(r.key) : monthLabel(r.key),
          r.payments,
          csvAmount(r.collected),
          csvAmount(r.refunded),
          csvAmount(r.net),
        ]),
      ];
    },
  },
  aging: {
    title: "Alacak yaşlandırma",
    async build() {
      const rows = await getReceivablesAging();
      return [["Vade aşımı", "Fatura", "Açık tutar"], ...rows.map((r) => [r.label, r.invoices, csvAmount(r.outstanding)])];
    },
  },
  kdv: {
    title: "KDV tahakkuk",
    async build(range) {
      const { rows, total } = await getKdvReport(range);
      const line = (r: (typeof rows)[number], label: string): Row => [
        label,
        r.invoices,
        csvAmount(r.salesBase),
        csvAmount(r.salesTax),
        r.refunds,
        csvAmount(r.refundBase),
        csvAmount(r.refundTax),
        csvAmount(r.netBase),
        csvAmount(r.netTax),
      ];
      return [
        ["Ay", "Fatura", "Satış matrahı", "Satış KDV", "İade", "İade matrahı", "İade KDV", "Net matrah", "Net KDV"],
        ...rows.map((r) => line(r, monthLabel(r.month))),
        line(total, "Toplam"),
      ];
    },
  },
  "kdv-unissued": {
    title: "E-belgesi kesilmemiş ödenmiş faturalar",
    async build(range) {
      const rows = await getUnissuedPaidInvoices(range);
      return [
        ["Fatura no", "Ödeme tarihi", "Müşteri", "Toplam", "E-belge durumu", "Hata"],
        ...rows.map((r) => [r.invoiceNumber, istanbulDateTime(r.paidAt), r.customer, csvAmount(r.total), r.eInvoiceStatus ?? "Kayıt yok", r.error ?? ""]),
      ];
    },
  },
  "kdv-mismatch": {
    title: "Tutarı farklı e-belgeler",
    async build(range) {
      const rows = await getEInvoiceMismatches(range);
      return [
        ["Fatura no", "Belge no", "Ödeme tarihi", "Müşteri", "Fatura toplamı", "Belge toplamı", "Fatura KDV", "Belge KDV"],
        ...rows.map((r) => [
          r.invoiceNumber,
          r.documentNumber ?? "",
          istanbulDateTime(r.paidAt),
          r.customer,
          csvAmount(r.invoiceTotal),
          csvAmount(r.documentTotal),
          csvAmount(r.invoiceTax),
          csvAmount(r.documentTax),
        ]),
      ];
    },
  },
  "domain-margin": {
    title: "Domain brüt kâr",
    async build(range) {
      const { rows } = await getDomainMarginReport(range);
      return [
        ["Fatura no", "Ödeme tarihi", "Alan adı", "İşlem", "Yıl", "Uzantı", "Satış (KDV hariç)", "Maliyet", "Para birimi", "Kur", "Kur tarihi", "Maliyet (TRY)", "Brüt kâr", "Kâr %", "Not"],
        ...rows.map((r) => [
          r.invoiceNumber,
          istanbulDateTime(r.paidAt),
          r.domain,
          DOMAIN_SALE_LABELS[r.kind],
          r.years,
          r.tld ?? "",
          csvAmount(r.sale),
          r.costForeign === null ? "" : csvAmount(r.costForeign, 4),
          r.costCurrency ?? "",
          r.rate === null ? "" : csvAmount(r.rate, 4),
          r.rateDay ? dayLabel(r.rateDay) : "",
          r.costTry === null ? "" : csvAmount(r.costTry),
          r.margin === null ? "" : csvAmount(r.margin),
          pct(r.marginPercent),
          r.issue === "NO_TLD" ? "Uzantı bulunamadı" : r.issue === "NO_COST" ? "Maliyet girilmemiş" : r.issue === "NO_RATE" ? "Kur yok" : "",
        ]),
      ];
    },
  },
} satisfies Record<string, ReportTableDef>;

export type ReportTableKey = keyof typeof REPORT_TABLES;

export function isReportTableKey(value: string | null): value is ReportTableKey {
  return value !== null && Object.prototype.hasOwnProperty.call(REPORT_TABLES, value);
}
