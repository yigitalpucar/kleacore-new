import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";

export async function getAdminDashboardStats() {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    totalCustomers,
    totalOrders,
    totalRevenue,
    activeServices,
    pendingTickets,
    recentOrders,
    upcomingInvoices,
    monthlyRevenue,
    newCustomersThisMonth,
  ] = await Promise.all([
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.order.count(),
    db.invoice.aggregate({
      where: { status: "PAID" },
      _sum: { paidAmount: true },
    }),
    db.service.count({ where: { status: "ACTIVE" } }),
    db.supportTicket.count({
      where: {
        status: { in: ["OPEN", "CUSTOMER_REPLY"] },
      },
    }),
    db.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { id: true, name: true, surname: true, email: true },
        },
        product: {
          select: { id: true, name: true },
        },
      },
    }),
    db.invoice.findMany({
      where: {
        status: { in: ["PENDING", "OVERDUE"] },
        dueDate: { lte: thirtyDaysFromNow },
      },
      take: 5,
      orderBy: { dueDate: "asc" },
      include: {
        customer: {
          select: { id: true, name: true, surname: true, email: true },
        },
      },
    }),
    db.invoice.aggregate({
      where: {
        status: "PAID",
        paidAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
        },
      },
      _sum: { paidAmount: true },
    }),
    db.user.count({
      where: {
        role: "CUSTOMER",
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
        },
      },
    }),
  ]);

  return {
    totalCustomers,
    totalOrders,
    totalRevenue: toNumber(totalRevenue._sum.paidAmount),
    activeServices,
    pendingTickets,
    recentOrders,
    upcomingInvoices,
    monthlyRevenue: toNumber(monthlyRevenue._sum.paidAmount),
    newCustomersThisMonth,
  };
}

export async function getCustomerDashboardStats(userId: string) {
  const [
    activeServices,
    totalInvoices,
    unpaidInvoices,
    openTickets,
    recentActivity,
    upcomingRenewals,
    balance,
  ] = await Promise.all([
    db.service.count({
      where: { customerId: userId, status: "ACTIVE" },
    }),
    db.invoice.count({
      where: { customerId: userId },
    }),
    db.invoice.count({
      where: {
        customerId: userId,
        status: { in: ["PENDING", "OVERDUE"] },
      },
    }),
    db.supportTicket.count({
      where: {
        customerId: userId,
        status: { notIn: ["CLOSED"] },
      },
    }),
    db.activityLog.findMany({
      where: { userId },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
    db.service.findMany({
      where: {
        customerId: userId,
        status: "ACTIVE",
        nextDueDate: {
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        product: {
          select: { id: true, name: true },
        },
      },
      orderBy: { nextDueDate: "asc" },
      take: 5,
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    }),
  ]);

  return {
    activeServices,
    totalInvoices,
    unpaidInvoices,
    openTickets,
    recentActivity,
    upcomingRenewals,
    balance: balance?.balance ?? 0,
  };
}
