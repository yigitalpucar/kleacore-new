import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { compare, max, min, money, percent, toNumber, type MoneyInput } from "@/lib/money";

type DbClient = Prisma.TransactionClient | typeof db;

/** Reseller discount for a line, rounded half-up to kuruş (0 when not applicable). */
export function applyResellerDiscount(basePrice: MoneyInput, discountPercent: MoneyInput) {
  const price = money(basePrice);
  const rate = money(discountPercent);

  if (compare(price, 0) <= 0 || compare(rate, 0) <= 0) {
    return money(0);
  }

  return percent(price, min(100, max(0, rate)));
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
    monthlyRevenue: toNumber(monthlyRevenue._sum.totalAmount),
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
    compare(reseller.resellerDiscountPercent, 0) <= 0
  ) {
    return null;
  }

  return {
    resellerId: reseller.id,
    discountPercent: toNumber(reseller.resellerDiscountPercent),
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