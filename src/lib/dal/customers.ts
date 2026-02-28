import { db } from "@/lib/db";
import {
  type PaginationParams,
  paginationMeta,
} from "@/lib/utils/pagination";
import type { CustomerType, UserStatus } from "@prisma/client";

interface GetCustomersParams extends PaginationParams {
  status?: UserStatus;
  customerType?: CustomerType;
}

export async function getCustomers(params: GetCustomersParams) {
  const { page, perPage, search, sortBy, sortOrder, status, customerType } =
    params;

  const where = {
    role: "CUSTOMER" as const,
    ...(status && { status }),
    ...(customerType && { customerType }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { surname: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
        { companyName: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        surname: true,
        phone: true,
        status: true,
        customerType: true,
        companyName: true,
        balance: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
            services: true,
            tickets: true,
          },
        },
      },
      orderBy: { [sortBy || "createdAt"]: sortOrder || "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.user.count({ where }),
  ]);

  return { data, ...paginationMeta(total, params) };
}

export async function getCustomerById(id: string) {
  return db.user.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { product: true },
      },
      services: {
        include: { product: true },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      tickets: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      domains: true,
      sslCertificates: true,
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
}

export async function getCustomerStats() {
  const [total, active, suspended, corporate, individual, totalBalance] =
    await Promise.all([
      db.user.count({ where: { role: "CUSTOMER" } }),
      db.user.count({
        where: { role: "CUSTOMER", status: "ACTIVE" },
      }),
      db.user.count({
        where: { role: "CUSTOMER", status: "SUSPENDED" },
      }),
      db.user.count({
        where: { role: "CUSTOMER", customerType: "CORPORATE" },
      }),
      db.user.count({
        where: { role: "CUSTOMER", customerType: "INDIVIDUAL" },
      }),
      db.user.aggregate({
        where: { role: "CUSTOMER" },
        _sum: { balance: true },
      }),
    ]);

  return {
    total,
    active,
    suspended,
    corporate,
    individual,
    totalBalance: totalBalance._sum.balance ?? 0,
  };
}
