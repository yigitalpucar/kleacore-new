/**
 * Revenue, collections and receivables reports (3.8). Aggregation happens
 * in SQL (indexes: invoices(status, paidAt), payments(status, paidAt));
 * amounts come back as Prisma.Decimal and stay Decimal until the UI edge.
 *
 * Timestamps are stored as UTC `timestamp(3)`; months/days are grouped on
 * the Europe/Istanbul calendar.
 */
import { Prisma, type PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { daysInRange, monthsInRange, type ReportRange } from "./range";

/** Invoice statuses that mean "was paid" (refunds are reported separately). */
export const PAID_INVOICE_STATUSES = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as const;

const localTs = (column: Prisma.Sql) => Prisma.sql`((${column}) AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul')`;

export const CATEGORY_LABELS: Record<string, string> = {
  hosting: "Hosting",
  vds: "VDS",
  vps: "VPS",
  server: "Sunucu",
  cloud: "Bulut",
  datacenter: "Veri merkezi",
  domain: "Alan adı",
  ssl: "SSL",
  email: "E-posta",
  other: "Diğer",
};

export interface CategoryRevenueRow {
  category: string;
  label: string;
  invoices: number;
  net: Prisma.Decimal;
  tax: Prisma.Decimal;
  gross: Prisma.Decimal;
}

/** Invoices paid in the range by product category (order → product → category; domain renewals → domain). */
export async function getRevenueByCategory(range: ReportRange): Promise<CategoryRevenueRow[]> {
  const rows = await db.$queryRaw<Array<{ category: string; invoices: number; net: Prisma.Decimal; tax: Prisma.Decimal; gross: Prisma.Decimal }>>`
    SELECT COALESCE(pc.slug::text, CASE WHEN dr.id IS NOT NULL THEN 'domain' END, 'other') AS category,
           COUNT(*)::int AS invoices,
           COALESCE(SUM(i.subtotal), 0) AS net,
           COALESCE(SUM(i."taxAmount"), 0) AS tax,
           COALESCE(SUM(i."totalAmount"), 0) AS gross
    FROM invoices i
    LEFT JOIN orders o ON o.id = i."orderId"
    LEFT JOIN products p ON p.id = o."productId"
    LEFT JOIN product_categories pc ON pc.id = p."categoryId"
    LEFT JOIN domain_renewals dr ON dr."invoiceId" = i.id
    WHERE i.status::text IN (${Prisma.join([...PAID_INVOICE_STATUSES])})
      AND i."paidAt" >= ${range.from} AND i."paidAt" <= ${range.to}
    GROUP BY 1
    ORDER BY net DESC`;
  return rows.map((row) => ({
    ...row,
    label: CATEGORY_LABELS[row.category] ?? row.category,
    net: money(row.net),
    tax: money(row.tax),
    gross: money(row.gross),
  }));
}

export interface MethodRevenueRow {
  method: PaymentMethod;
  payments: number;
  amount: Prisma.Decimal;
}

/** Money received in the range by payment method (completed payments, incl. later refunded ones). */
export async function getRevenueByMethod(range: ReportRange): Promise<MethodRevenueRow[]> {
  const rows = await db.$queryRaw<Array<{ method: PaymentMethod; payments: number; amount: Prisma.Decimal }>>`
    SELECT method, COUNT(*)::int AS payments, COALESCE(SUM(amount), 0) AS amount
    FROM payments
    WHERE status::text IN ('COMPLETED', 'REFUNDED')
      AND "paidAt" >= ${range.from} AND "paidAt" <= ${range.to}
    GROUP BY method
    ORDER BY amount DESC`;
  return rows.map((row) => ({ ...row, amount: money(row.amount) }));
}

export type CollectionGranularity = "day" | "month";

export interface CollectionRow {
  /** "YYYY-MM-DD" or "YYYY-MM". */
  key: string;
  collected: Prisma.Decimal;
  refunded: Prisma.Decimal;
  net: Prisma.Decimal;
  payments: number;
}

/** Daily buckets up to ~2 months, monthly beyond. */
export function collectionGranularity(range: ReportRange): CollectionGranularity {
  return daysInRange(range).length <= 62 ? "day" : "month";
}

/** Payments received and refunds paid out, per day or month (zero-filled). */
export async function getCollections(range: ReportRange): Promise<{ granularity: CollectionGranularity; rows: CollectionRow[] }> {
  const granularity = collectionGranularity(range);
  const format = granularity === "day" ? "YYYY-MM-DD" : "YYYY-MM";

  const [payments, refunds] = await Promise.all([
    db.$queryRaw<Array<{ key: string; amount: Prisma.Decimal; payments: number }>>`
      SELECT to_char(${localTs(Prisma.sql`"paidAt"`)}, ${format}) AS key,
             COALESCE(SUM(amount), 0) AS amount, COUNT(*)::int AS payments
      FROM payments
      WHERE status::text IN ('COMPLETED', 'REFUNDED')
        AND "paidAt" >= ${range.from} AND "paidAt" <= ${range.to}
      GROUP BY 1`,
    db.$queryRaw<Array<{ key: string; amount: Prisma.Decimal }>>`
      SELECT to_char(${localTs(Prisma.sql`"completedAt"`)}, ${format}) AS key, COALESCE(SUM(amount), 0) AS amount
      FROM refunds
      WHERE status::text = 'COMPLETED'
        AND "completedAt" >= ${range.from} AND "completedAt" <= ${range.to}
      GROUP BY 1`,
  ]);

  const paid = new Map(payments.map((row) => [row.key, row]));
  const refunded = new Map(refunds.map((row) => [row.key, money(row.amount)]));
  const keys = granularity === "day" ? daysInRange(range) : monthsInRange(range);

  return {
    granularity,
    rows: keys.map((key) => {
      const collected = money(paid.get(key)?.amount);
      const out = refunded.get(key) ?? money(0);
      return { key, collected, refunded: out, net: collected.minus(out), payments: paid.get(key)?.payments ?? 0 };
    }),
  };
}

export const AGING_BUCKETS = [
  { key: "current", label: "Vadesi gelmemiş" },
  { key: "0-30", label: "0–30 gün" },
  { key: "31-60", label: "31–60 gün" },
  { key: "61-90", label: "61–90 gün" },
  { key: "90+", label: "90+ gün" },
] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number]["key"];

/** Bucket of an unpaid invoice by whole days past its due date. */
export function agingBucket(dueDate: Date, now: Date): AgingBucket {
  const days = Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000);
  if (days < 0) return "current";
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export interface AgingRow {
  bucket: AgingBucket;
  label: string;
  invoices: number;
  outstanding: Prisma.Decimal;
}

/**
 * Open receivables today (PENDING/OVERDUE, total − paid), by days past due.
 * A snapshot: it does not depend on the selected range.
 */
export async function getReceivablesAging(now: Date = new Date()): Promise<AgingRow[]> {
  const rows = await db.$queryRaw<Array<{ bucket: AgingBucket; invoices: number; outstanding: Prisma.Decimal }>>`
    SELECT CASE
             WHEN "dueDate" > ${now} THEN 'current'
             WHEN floor(extract(epoch FROM (${now}::timestamp - "dueDate")) / 86400) <= 30 THEN '0-30'
             WHEN floor(extract(epoch FROM (${now}::timestamp - "dueDate")) / 86400) <= 60 THEN '31-60'
             WHEN floor(extract(epoch FROM (${now}::timestamp - "dueDate")) / 86400) <= 90 THEN '61-90'
             ELSE '90+'
           END AS bucket,
           COUNT(*)::int AS invoices,
           COALESCE(SUM(GREATEST("totalAmount" - "paidAmount", 0)), 0) AS outstanding
    FROM invoices
    WHERE status::text IN ('PENDING', 'OVERDUE')
    GROUP BY 1`;
  const byBucket = new Map(rows.map((row) => [row.bucket, row]));
  return AGING_BUCKETS.map(({ key, label }) => ({
    bucket: key,
    label,
    invoices: byBucket.get(key)?.invoices ?? 0,
    outstanding: money(byBucket.get(key)?.outstanding),
  }));
}
