import { db } from "@/lib/db";
import { roundMoney } from "@/lib/payments/orchestrator";
import type { PaymentMethod, Prisma } from "@prisma/client";
import { add, money, sum, toNumber, type MoneyInput } from "@/lib/money";

export { roundMoney };

export interface DateRange {
  from: Date;
  to: Date;
}

export interface CollectedByMethod {
  CREDIT_CARD: number;
  BANK_TRANSFER: number;
  BALANCE: number;
}

export interface AccountingSummary {
  grossRevenue: number;
  netRevenue: number;
  totalTax: number;
  collectedByMethod: CollectedByMethod;
  outstanding: number;
  overdueCount: number;
  pendingCount: number;
  refunds: {
    count: number;
    sum: number;
  };
}

export interface MonthlyTaxRow {
  month: string;
  label: string;
  subtotal: number;
  tax: number;
  total: number;
}

export interface LedgerEntry {
  date: Date;
  invoiceNumber: string;
  customerName: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod | null;
}

const monthNames = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(month: string) {
  const [year, monthPart] = month.split("-");
  const monthIndex = Number(monthPart) - 1;
  if (!year || monthIndex < 0 || monthIndex > 11) {
    return month;
  }
  return `${monthNames[monthIndex]} ${year}`;
}

export function emptyCollectedByMethod(): CollectedByMethod {
  return {
    CREDIT_CARD: 0,
    BANK_TRANSFER: 0,
    BALANCE: 0,
  };
}

export function calculateAccountingSummary(
  paidInvoices: Array<{
    subtotal: MoneyInput;
    taxAmount: MoneyInput;
    totalAmount: MoneyInput;
  }>,
  completedPayments: Array<{ method: PaymentMethod; amount: MoneyInput }>,
  outstandingInvoices: Array<{ status: string; totalAmount: MoneyInput }>,
  cancelledInvoices: Array<{ totalAmount: MoneyInput }>
): AccountingSummary {
  const grossRevenue = toNumber(sum(paidInvoices.map((invoice) => invoice.totalAmount)));
  const netRevenue = toNumber(sum(paidInvoices.map((invoice) => invoice.subtotal)));
  const totalTax = toNumber(sum(paidInvoices.map((invoice) => invoice.taxAmount)));

  const collectedByMethod = emptyCollectedByMethod();
  for (const method of Object.keys(collectedByMethod) as PaymentMethod[]) {
    collectedByMethod[method] = toNumber(
      sum(completedPayments.filter((payment) => payment.method === method).map((payment) => payment.amount))
    );
  }

  const outstanding = toNumber(sum(outstandingInvoices.map((invoice) => invoice.totalAmount)));
  const overdueCount = outstandingInvoices.filter(
    (invoice) => invoice.status === "OVERDUE"
  ).length;
  const pendingCount = outstandingInvoices.filter(
    (invoice) => invoice.status === "PENDING"
  ).length;

  const refunds = {
    count: cancelledInvoices.length,
    sum: toNumber(sum(cancelledInvoices.map((invoice) => invoice.totalAmount))),
  };

  return {
    grossRevenue,
    netRevenue,
    totalTax,
    collectedByMethod,
    outstanding,
    overdueCount,
    pendingCount,
    refunds,
  };
}

export function groupMonthlyTaxBreakdown(
  invoices: Array<{
    paidAt: Date | null;
    subtotal: MoneyInput;
    taxAmount: MoneyInput;
    totalAmount: MoneyInput;
  }>
): MonthlyTaxRow[] {
  const byMonth = new Map<
    string,
    { subtotal: Prisma.Decimal; tax: Prisma.Decimal; total: Prisma.Decimal }
  >();

  for (const invoice of invoices) {
    if (!invoice.paidAt) continue;
    const key = monthKey(new Date(invoice.paidAt));
    const current = byMonth.get(key) ?? { subtotal: money(0), tax: money(0), total: money(0) };
    byMonth.set(key, {
      subtotal: add(current.subtotal, invoice.subtotal),
      tax: add(current.tax, invoice.taxAmount),
      total: add(current.total, invoice.totalAmount),
    });
  }

  return Array.from(byMonth.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, values]) => ({
      month,
      label: formatMonthLabel(month),
      subtotal: toNumber(values.subtotal),
      tax: toNumber(values.tax),
      total: toNumber(values.total),
    }));
}

export function buildLedgerEntries(
  invoices: Array<{
    paidAt: Date | null;
    invoiceNumber: string;
    subtotal: MoneyInput;
    taxAmount: MoneyInput;
    totalAmount: MoneyInput;
    customer: { name: string; surname: string; email: string };
    payments: Array<{ method: PaymentMethod; status: string }>;
  }>
): LedgerEntry[] {
  return invoices
    .filter((invoice) => invoice.paidAt)
    .map((invoice) => {
      const completedPayment = invoice.payments.find(
        (payment) => payment.status === "COMPLETED"
      );
      const customerName =
        `${invoice.customer.name} ${invoice.customer.surname}`.trim() ||
        invoice.customer.email;

      return {
        date: new Date(invoice.paidAt!),
        invoiceNumber: invoice.invoiceNumber,
        customerName,
        subtotal: toNumber(invoice.subtotal),
        taxAmount: toNumber(invoice.taxAmount),
        totalAmount: toNumber(invoice.totalAmount),
        paymentMethod: completedPayment?.method ?? null,
      };
    });
}

export async function getAccountingSummary(dateRange: DateRange): Promise<AccountingSummary> {
  const { from, to } = dateRange;

  const [paidInvoices, outstandingInvoices, cancelledInvoices, completedPayments] =
    await Promise.all([
      db.invoice.findMany({
        where: {
          status: "PAID",
          paidAt: { gte: from, lte: to },
        },
        select: {
          subtotal: true,
          taxAmount: true,
          totalAmount: true,
        },
      }),
      db.invoice.findMany({
        where: {
          status: { in: ["PENDING", "OVERDUE"] },
        },
        select: {
          status: true,
          totalAmount: true,
        },
      }),
      db.invoice.findMany({
        where: {
          status: "CANCELLED",
          updatedAt: { gte: from, lte: to },
        },
        select: {
          totalAmount: true,
        },
      }),
      db.payment.findMany({
        where: {
          status: "COMPLETED",
          invoice: {
            status: "PAID",
            paidAt: { gte: from, lte: to },
          },
        },
        select: {
          method: true,
          amount: true,
        },
      }),
    ]);

  return calculateAccountingSummary(
    paidInvoices,
    completedPayments,
    outstandingInvoices,
    cancelledInvoices
  );
}

export async function getAccountingLedger(
  dateRange: DateRange,
  limit = 100,
  order: "asc" | "desc" = "asc"
): Promise<LedgerEntry[]> {
  const invoices = await db.invoice.findMany({
    where: {
      status: "PAID",
      paidAt: { gte: dateRange.from, lte: dateRange.to },
    },
    include: {
      customer: {
        select: { name: true, surname: true, email: true },
      },
      payments: {
        where: { status: "COMPLETED" },
        select: { method: true, status: true },
        orderBy: { paidAt: "desc" },
        take: 1,
      },
    },
    orderBy: { paidAt: order },
    take: limit,
  });

  return buildLedgerEntries(invoices);
}

export async function getMonthlyTaxBreakdown(dateRange: DateRange): Promise<MonthlyTaxRow[]> {
  const paidInvoices = await db.invoice.findMany({
    where: {
      status: "PAID",
      paidAt: { gte: dateRange.from, lte: dateRange.to },
    },
    select: {
      paidAt: true,
      subtotal: true,
      taxAmount: true,
      totalAmount: true,
    },
  });

  return groupMonthlyTaxBreakdown(paidInvoices);
}