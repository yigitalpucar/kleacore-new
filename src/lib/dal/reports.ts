import { db } from "@/lib/db";
import {
  getAccountingLedger,
  getAccountingSummary,
  getMonthlyTaxBreakdown,
} from "@/lib/reports/accounting";

export interface DateRange {
  from: Date;
  to: Date;
}

export {
  getAccountingSummary,
  getAccountingLedger,
  getMonthlyTaxBreakdown,
} from "@/lib/reports/accounting";

export async function getRevenueReport(dateRange: DateRange) {
  const { from, to } = dateRange;

  const [paidInvoices, totalRevenue, invoiceCount, avgInvoiceAmount, topProducts] =
    await Promise.all([
      db.invoice.findMany({
        where: {
          status: "PAID",
          paidAt: { gte: from, lte: to },
        },
        include: {
          items: true,
          customer: {
            select: { id: true, name: true, surname: true },
          },
        },
        orderBy: { paidAt: "desc" },
      }),
      db.invoice.aggregate({
        where: {
          status: "PAID",
          paidAt: { gte: from, lte: to },
        },
        _sum: { paidAmount: true },
      }),
      db.invoice.count({
        where: {
          status: "PAID",
          paidAt: { gte: from, lte: to },
        },
      }),
      db.invoice.aggregate({
        where: {
          status: "PAID",
          paidAt: { gte: from, lte: to },
        },
        _avg: { paidAmount: true },
      }),
      db.order.groupBy({
        by: ["productId"],
        where: {
          status: "COMPLETED",
          completedAt: { gte: from, lte: to },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
        orderBy: { _sum: { totalAmount: "desc" } },
        take: 10,
      }),
    ]);

  return {
    paidInvoices,
    totalRevenue: totalRevenue._sum.paidAmount ?? 0,
    invoiceCount,
    avgInvoiceAmount: avgInvoiceAmount._avg.paidAmount ?? 0,
    topProducts,
  };
}

export async function getCustomerReport(dateRange?: DateRange) {
  const defaultFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const from = dateRange?.from ?? defaultFrom;
  const to = dateRange?.to ?? new Date();

  const [
    totalCustomers,
    activeCustomers,
    newInPeriod,
    topByRevenue,
    customersByType,
  ] = await Promise.all([
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.user.count({
      where: { role: "CUSTOMER", status: "ACTIVE" },
    }),
    db.user.count({
      where: {
        role: "CUSTOMER",
        createdAt: {
          gte: from,
          lte: to,
        },
      },
    }),
    db.invoice.groupBy({
      by: ["customerId"],
      where: {
        status: "PAID",
        paidAt: { gte: from, lte: to },
      },
      _sum: { paidAmount: true },
      _count: { id: true },
      orderBy: { _sum: { paidAmount: "desc" } },
      take: 10,
    }),
    db.user.groupBy({
      by: ["customerType"],
      where: { role: "CUSTOMER" },
      _count: { id: true },
    }),
  ]);

  return {
    totalCustomers,
    activeCustomers,
    newInPeriod,
    topByRevenue,
    customersByType,
  };
}

export async function getServiceReport(dateRange?: DateRange) {
  const from = dateRange?.from;
  const to = dateRange?.to;

  const [
    totalServices,
    servicesByStatus,
    servicesByCategory,
    expiringServices,
    monthlyRecurring,
  ] = await Promise.all([
    db.service.count(),
    db.service.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    db.order.groupBy({
      by: ["productId"],
      where: {
        status: "COMPLETED",
        ...(from && to ? { completedAt: { gte: from, lte: to } } : {}),
      },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    db.service.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: {
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        customer: {
          select: { id: true, name: true, surname: true, email: true },
        },
        product: {
          select: { id: true, name: true },
        },
      },
      orderBy: { expiresAt: "asc" },
      take: 20,
    }),
    db.service.aggregate({
      where: { status: "ACTIVE" },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalServices,
    servicesByStatus,
    servicesByCategory,
    expiringServices,
    monthlyRecurring: monthlyRecurring._sum.amount ?? 0,
  };
}

export async function getAccountingReport(dateRange: DateRange) {
  const [summary, ledgerPreview, taxBreakdown] = await Promise.all([
    getAccountingSummary(dateRange),
    getAccountingLedger(dateRange, 20, "desc"),
    getMonthlyTaxBreakdown(dateRange),
  ]);

  return {
    summary,
    ledgerPreview,
    taxBreakdown,
  };
}
