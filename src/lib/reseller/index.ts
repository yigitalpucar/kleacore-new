import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof db;

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export function applyResellerDiscount(basePrice: number, discountPercent: number) {
  const price = Number(basePrice);
  const percent = Number(discountPercent);

  if (!Number.isFinite(price) || price <= 0) {
    return 0;
  }

  if (!Number.isFinite(percent) || percent <= 0) {
    return 0;
  }

  const normalizedPercent = Math.min(100, Math.max(0, percent));
  return roundMoney(price * (normalizedPercent / 100));
}

export async function isResellerUser(userId: string, client: DbClient = db) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { isReseller: true, status: true },
  });

  return Boolean(user?.isReseller && user.status === "ACTIVE");
}

export async function getResellerStats(resellerId: string, client: DbClient = db) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [customerCount, activeServices, monthlyRevenue] = await Promise.all([
    client.user.count({
      where: { parentResellerId: resellerId },
    }),
    client.service.count({
      where: {
        status: "ACTIVE",
        customer: { parentResellerId: resellerId },
      },
    }),
    client.invoice.aggregate({
      where: {
        status: "PAID",
        paidAt: {
          gte: monthStart,
          lt: monthEnd,
        },
        customer: { parentResellerId: resellerId },
      },
      _sum: { totalAmount: true },
    }),
  ]);

  return {
    customerCount,
    activeServices,
    monthlyRevenue: roundMoney(Number(monthlyRevenue._sum.totalAmount ?? 0)),
  };
}

export async function getResellerCustomers(resellerId: string, client: DbClient = db) {
  return client.user.findMany({
    where: { parentResellerId: resellerId },
    select: {
      id: true,
      name: true,
      surname: true,
      email: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          services: { where: { status: "ACTIVE" } },
          orders: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getResellerDiscountForCustomer(
  customerId: string,
  client: DbClient = db
) {
  const customer = await client.user.findUnique({
    where: { id: customerId },
    select: { parentResellerId: true },
  });

  if (!customer?.parentResellerId) {
    return null;
  }

  const reseller = await client.user.findUnique({
    where: { id: customer.parentResellerId },
    select: {
      id: true,
      isReseller: true,
      status: true,
      resellerDiscountPercent: true,
      name: true,
      surname: true,
    },
  });

  if (
    !reseller?.isReseller ||
    reseller.status !== "ACTIVE" ||
    reseller.resellerDiscountPercent <= 0
  ) {
    return null;
  }

  return {
    resellerId: reseller.id,
    discountPercent: reseller.resellerDiscountPercent,
    resellerName: `${reseller.name} ${reseller.surname}`.trim(),
  };
}

export async function assignCustomerToReseller(
  customerId: string,
  resellerId: string,
  client: DbClient = db
) {
  if (customerId === resellerId) {
    throw new Error("RESELLER_SELF_ASSIGN");
  }

  const [customer, reseller] = await Promise.all([
    client.user.findUnique({
      where: { id: customerId },
      select: { id: true, role: true, parentResellerId: true },
    }),
    client.user.findUnique({
      where: { id: resellerId },
      select: { id: true, isReseller: true, status: true },
    }),
  ]);

  if (!customer || customer.role !== "CUSTOMER") {
    throw new Error("CUSTOMER_NOT_FOUND");
  }

  if (!reseller?.isReseller || reseller.status !== "ACTIVE") {
    throw new Error("RESELLER_NOT_FOUND");
  }

  if (customer.parentResellerId === resellerId) {
    return customer;
  }

  return client.user.update({
    where: { id: customerId },
    data: { parentResellerId: resellerId },
    select: { id: true, parentResellerId: true },
  });
}

export async function listResellers(client: DbClient = db) {
  return client.user.findMany({
    where: { isReseller: true },
    select: {
      id: true,
      name: true,
      surname: true,
      email: true,
      status: true,
      resellerDiscountPercent: true,
      createdAt: true,
      _count: {
        select: { resellerCustomers: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}