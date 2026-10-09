import { z } from "zod/v4";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { getReceivablesAging } from "@/lib/reports/finance";
import { getMrrReport } from "@/lib/reports/mrr";
import { parseReportRange, REPORT_PERIODS } from "@/lib/reports/range";
import { defineOperation } from "../operation";
import { dateTimeSchema, decimal, moneySchema } from "../schemas";

const TAG = "Reports";

export const mrrReport = defineOperation({
  id: "getMrrReport",
  method: "GET",
  path: "/reports/mrr",
  tag: TAG,
  summary: "MRR anlık görüntüsü + aylık hareket",
  description:
    "Yinelenen hizmetlerden MRR/ARR/ARPU (KDV hariç, aylığa normalize) ve seçilen aralığın aylık yeni/kayıp MRR'ı. Rapor sayfasıyla aynı hesap (src/lib/reports/mrr.ts).",
  permission: "reports.view",
  query: z.object({
    period: z.enum(REPORT_PERIODS).optional().describe("Varsayılan 30days"),
    from: z.iso.date().optional().describe("YYYY-MM-DD (to ile birlikte)"),
    to: z.iso.date().optional(),
  }),
  response: z.object({
    range: z.object({ from: dateTimeSchema, to: dateTimeSchema, period: z.string() }),
    current: z.object({ mrr: moneySchema, arr: moneySchema, customers: z.number().int(), services: z.number().int(), arpu: moneySchema.nullable() }),
    months: z.array(
      z.object({
        month: z.string().describe("YYYY-MM"),
        startMrr: moneySchema,
        endMrr: moneySchema,
        newMrr: moneySchema,
        churnedMrr: moneySchema,
        startCustomers: z.number().int(),
        endCustomers: z.number().int(),
        newCustomers: z.number().int(),
        churnedCustomers: z.number().int(),
        logoChurnRate: z.string().nullable().describe("Yüzde"),
        revenueChurnRate: z.string().nullable().describe("Yüzde"),
        arpu: moneySchema.nullable(),
      })
    ),
  }),
  handler: async ({ query }) => {
    const range = parseReportRange({ period: query.period, from: query.from, to: query.to });
    const report = await getMrrReport(range);
    return {
      data: {
        range: { from: range.from.toISOString(), to: range.to.toISOString(), period: range.period },
        current: {
          mrr: decimal(report.current.mrr)!,
          arr: decimal(report.current.arr)!,
          customers: report.current.customers,
          services: report.current.services,
          arpu: decimal(report.current.arpu),
        },
        months: report.months.map((row) => ({
          ...row,
          startMrr: decimal(row.startMrr)!,
          endMrr: decimal(row.endMrr)!,
          newMrr: decimal(row.newMrr)!,
          churnedMrr: decimal(row.churnedMrr)!,
          logoChurnRate: decimal(row.logoChurnRate),
          revenueChurnRate: decimal(row.revenueChurnRate),
          arpu: decimal(row.arpu),
        })),
      },
    };
  },
});

export const receivablesReport = defineOperation({
  id: "getReceivablesSummary",
  method: "GET",
  path: "/reports/receivables",
  tag: TAG,
  summary: "Alacak özeti (yaşlandırma)",
  description: "Bugün açık (PENDING/OVERDUE) faturaların kalan tutarı, gecikme gününe göre kovalara ayrılmış; toplam ve vadesi geçmiş toplam.",
  permission: "reports.view",
  response: z.object({
    asOf: dateTimeSchema,
    totalOutstanding: moneySchema,
    overdueOutstanding: moneySchema,
    openInvoices: z.number().int(),
    overdueInvoices: z.number().int(),
    customersWithDebt: z.number().int(),
    buckets: z.array(z.object({ bucket: z.string(), label: z.string(), invoices: z.number().int(), outstanding: moneySchema })),
  }),
  handler: async () => {
    const now = new Date();
    const [buckets, debtors] = await Promise.all([
      getReceivablesAging(now),
      db.invoice.groupBy({ by: ["customerId"], where: { status: { in: ["PENDING", "OVERDUE"] } } }),
    ]);
    const total = buckets.reduce((sum, row) => sum.plus(row.outstanding), money(0));
    const overdue = buckets.filter((row) => row.bucket !== "current");
    const overdueTotal = overdue.reduce((sum, row) => sum.plus(row.outstanding), money(0));
    return {
      data: {
        asOf: now.toISOString(),
        totalOutstanding: decimal(total)!,
        overdueOutstanding: decimal(overdueTotal)!,
        openInvoices: buckets.reduce((sum, row) => sum + row.invoices, 0),
        overdueInvoices: overdue.reduce((sum, row) => sum + row.invoices, 0),
        customersWithDebt: debtors.length,
        buckets: buckets.map((row) => ({ bucket: row.bucket, label: row.label, invoices: row.invoices, outstanding: decimal(row.outstanding)! })),
      },
    };
  },
});
