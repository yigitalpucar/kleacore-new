/**
 * KDV tahakkuk (accrued VAT) per month and e-invoice reconciliation (3.8).
 *
 * - Sales: invoices PAID within the month (paidAt, Istanbul calendar) — the
 *   moment the official e-document is issued — whatever their status is
 *   today (a later refund does not move the sale out of its month).
 *   Matrah = subtotal, KDV = taxAmount as stored on the invoice.
 * - Refunds: COMPLETED refunds are subtracted in the month they were paid
 *   back (iade faturası month). A refund is a KDV-inclusive amount; it is
 *   split with the invoice's rate: KDV = amount × r / (100 + r), half-up to
 *   the kuruş, matrah = amount − KDV.
 * - Reconciliation: paid invoices without an issued e-document (SENT/
 *   ACCEPTED), and issued documents whose UBL totals (stored ublPayload)
 *   differ from the invoice.
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { money, roundHalfUp, type MoneyInput } from "@/lib/money";
import { monthsInRange, type ReportRange } from "./range";

const localMonth = (column: Prisma.Sql) =>
  Prisma.sql`to_char(((${column}) AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul'), 'YYYY-MM')`;

/** Splits a KDV-inclusive amount into matrah + KDV at `taxRate` percent. */
export function splitGross(amount: MoneyInput, taxRate: MoneyInput): { base: Prisma.Decimal; tax: Prisma.Decimal } {
  const gross = money(amount);
  const rate = money(taxRate);
  const tax = roundHalfUp(gross.times(rate).dividedBy(rate.plus(100)));
  return { base: gross.minus(tax), tax };
}

export interface KdvSalesInput {
  month: string;
  invoices: number;
  base: MoneyInput;
  tax: MoneyInput;
  total: MoneyInput;
}

export interface KdvRefundInput {
  month: string;
  amount: MoneyInput;
  taxRate: MoneyInput;
}

export interface KdvMonthRow {
  month: string;
  invoices: number;
  salesBase: Prisma.Decimal;
  salesTax: Prisma.Decimal;
  salesTotal: Prisma.Decimal;
  refunds: number;
  refundBase: Prisma.Decimal;
  refundTax: Prisma.Decimal;
  /** Net matrah = sales − refunds. */
  netBase: Prisma.Decimal;
  /** Net hesaplanan KDV = sales KDV − refund KDV. */
  netTax: Prisma.Decimal;
}

/** Pure: monthly KDV rows (every month of `months`, zero-filled) and their total. */
export function computeKdvReport(
  months: string[],
  sales: KdvSalesInput[],
  refunds: KdvRefundInput[]
): { rows: KdvMonthRow[]; total: KdvMonthRow } {
  const empty = (month: string): KdvMonthRow => ({
    month,
    invoices: 0,
    salesBase: new Prisma.Decimal(0),
    salesTax: new Prisma.Decimal(0),
    salesTotal: new Prisma.Decimal(0),
    refunds: 0,
    refundBase: new Prisma.Decimal(0),
    refundTax: new Prisma.Decimal(0),
    netBase: new Prisma.Decimal(0),
    netTax: new Prisma.Decimal(0),
  });
  const byMonth = new Map<string, KdvMonthRow>(months.map((month) => [month, empty(month)]));
  const row = (month: string) => {
    let current = byMonth.get(month);
    if (!current) {
      current = empty(month);
      byMonth.set(month, current);
    }
    return current;
  };

  for (const sale of sales) {
    const r = row(sale.month);
    r.invoices += sale.invoices;
    r.salesBase = r.salesBase.plus(money(sale.base));
    r.salesTax = r.salesTax.plus(money(sale.tax));
    r.salesTotal = r.salesTotal.plus(money(sale.total));
  }
  for (const refund of refunds) {
    const r = row(refund.month);
    const split = splitGross(refund.amount, refund.taxRate);
    r.refunds += 1;
    r.refundBase = r.refundBase.plus(split.base);
    r.refundTax = r.refundTax.plus(split.tax);
  }

  const rows = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  const total = empty("Toplam");
  for (const r of rows) {
    r.netBase = r.salesBase.minus(r.refundBase);
    r.netTax = r.salesTax.minus(r.refundTax);
    total.invoices += r.invoices;
    total.refunds += r.refunds;
    total.salesBase = total.salesBase.plus(r.salesBase);
    total.salesTax = total.salesTax.plus(r.salesTax);
    total.salesTotal = total.salesTotal.plus(r.salesTotal);
    total.refundBase = total.refundBase.plus(r.refundBase);
    total.refundTax = total.refundTax.plus(r.refundTax);
  }
  total.netBase = total.salesBase.minus(total.refundBase);
  total.netTax = total.salesTax.minus(total.refundTax);
  return { rows, total };
}

export async function getKdvReport(range: ReportRange) {
  const [sales, refunds] = await Promise.all([
    db.$queryRaw<Array<{ month: string; invoices: number; base: Prisma.Decimal; tax: Prisma.Decimal; total: Prisma.Decimal }>>`
      SELECT ${localMonth(Prisma.sql`"paidAt"`)} AS month,
             COUNT(*)::int AS invoices,
             COALESCE(SUM(subtotal), 0) AS base,
             COALESCE(SUM("taxAmount"), 0) AS tax,
             COALESCE(SUM("totalAmount"), 0) AS total
      FROM invoices
      WHERE status::text IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
        AND "paidAt" >= ${range.from} AND "paidAt" <= ${range.to}
      GROUP BY 1`,
    // One row per refund: each iade is rounded on its own, like its document.
    db.$queryRaw<Array<{ month: string; amount: Prisma.Decimal; taxRate: Prisma.Decimal }>>`
      SELECT ${localMonth(Prisma.sql`r."completedAt"`)} AS month, r.amount, i."taxRate" AS "taxRate"
      FROM refunds r
      JOIN invoices i ON i.id = r."invoiceId"
      WHERE r.status::text = 'COMPLETED'
        AND r."completedAt" >= ${range.from} AND r."completedAt" <= ${range.to}`,
  ]);
  return computeKdvReport(monthsInRange(range), sales, refunds);
}

export interface UnissuedInvoiceRow {
  id: string;
  invoiceNumber: string;
  paidAt: Date;
  customer: string;
  total: Prisma.Decimal;
  /** e-document status, null when no record exists. */
  eInvoiceStatus: string | null;
  error: string | null;
}

export interface MismatchRow {
  id: string;
  invoiceNumber: string;
  documentNumber: string | null;
  paidAt: Date;
  customer: string;
  invoiceTotal: Prisma.Decimal;
  documentTotal: Prisma.Decimal;
  invoiceTax: Prisma.Decimal;
  documentTax: Prisma.Decimal;
}

const RECONCILE_LIMIT = 500;

/** Paid invoices of the range without an issued (SENT/ACCEPTED) e-document. */
export async function getUnissuedPaidInvoices(range: ReportRange): Promise<UnissuedInvoiceRow[]> {
  const rows = await db.$queryRaw<Array<Omit<UnissuedInvoiceRow, "total"> & { total: Prisma.Decimal }>>`
    SELECT i.id, i."invoiceNumber" AS "invoiceNumber", i."paidAt" AS "paidAt",
           COALESCE(NULLIF(u."companyName", ''), TRIM(u.name || ' ' || u.surname)) AS customer,
           i."totalAmount" AS total, e.status::text AS "eInvoiceStatus", e."errorMessage" AS error
    FROM invoices i
    JOIN users u ON u.id = i."customerId"
    LEFT JOIN e_invoice_records e ON e."invoiceId" = i.id
    WHERE i.status::text IN ('PAID', 'PARTIALLY_REFUNDED')
      AND i."paidAt" >= ${range.from} AND i."paidAt" <= ${range.to}
      AND i."totalAmount" > 0
      AND (e.id IS NULL OR e.status::text NOT IN ('SENT', 'ACCEPTED'))
    ORDER BY i."paidAt" ASC
    LIMIT ${RECONCILE_LIMIT}`;
  return rows.map((row) => ({ ...row, total: money(row.total) }));
}

/** Issued e-documents of the range whose payable/KDV totals differ from the invoice. */
export async function getEInvoiceMismatches(range: ReportRange): Promise<MismatchRow[]> {
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      invoiceNumber: string;
      documentNumber: string | null;
      paidAt: Date;
      customer: string;
      invoiceTotal: Prisma.Decimal;
      invoiceTax: Prisma.Decimal;
      documentKurus: bigint | number;
      documentTaxKurus: bigint | number;
    }>
  >`
    SELECT * FROM (
      SELECT i.id, i."invoiceNumber" AS "invoiceNumber", e."documentNumber" AS "documentNumber", i."paidAt" AS "paidAt",
             COALESCE(NULLIF(u."companyName", ''), TRIM(u.name || ' ' || u.surname)) AS customer,
             i."totalAmount" AS "invoiceTotal", i."taxAmount" AS "invoiceTax",
             (e."ublPayload" #>> '{document,totals,payableKurus}')::bigint AS "documentKurus",
             (e."ublPayload" #>> '{document,totals,taxKurus}')::bigint AS "documentTaxKurus"
      FROM e_invoice_records e
      JOIN invoices i ON i.id = e."invoiceId"
      JOIN users u ON u.id = i."customerId"
      WHERE e.status::text IN ('SENT', 'ACCEPTED')
        AND i."paidAt" >= ${range.from} AND i."paidAt" <= ${range.to}
        AND (e."ublPayload" #>> '{document,totals,payableKurus}') ~ '^-?[0-9]+$'
        AND (e."ublPayload" #>> '{document,totals,taxKurus}') ~ '^-?[0-9]+$'
    ) t
    WHERE t."documentKurus" <> round(t."invoiceTotal" * 100)
       OR t."documentTaxKurus" <> round(t."invoiceTax" * 100)
    ORDER BY t."paidAt" ASC
    LIMIT ${RECONCILE_LIMIT}`;
  return rows.map((row) => ({
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    documentNumber: row.documentNumber,
    paidAt: row.paidAt,
    customer: row.customer,
    invoiceTotal: money(row.invoiceTotal),
    invoiceTax: money(row.invoiceTax),
    documentTotal: money(String(row.documentKurus)).dividedBy(100),
    documentTax: money(String(row.documentTaxKurus)).dividedBy(100),
  }));
}
