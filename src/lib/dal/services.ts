import { db } from "@/lib/db";
import {
  type PaginationParams,
  paginationMeta,
} from "@/lib/utils/pagination";
import type { ProductCategorySlug, ServiceStatus } from "@prisma/client";
import { toNumber } from "@/lib/money";

interface GetServicesParams extends PaginationParams {
  status?: ServiceStatus;
  categorySlug?: ProductCategorySlug;
  customerId?: string;
}

export async function getServices(params: GetServicesParams) {
  const {
    page,
    perPage,
    search,
    sortBy,
    sortOrder,
    status,
    categorySlug,
    customerId,
  } = params;

  const where = {
    ...(status && { status }),
    ...(customerId && { customerId }),
    ...(categorySlug && {
      product: { category: { slug: categorySlug } },
    }),
    ...(search && {
      OR: [
        { label: { contains: search, mode: "insensitive" as const } },
        { domain: { contains: search, mode: "insensitive" as const } },
        { ipAddress: { contains: search, mode: "insensitive" as const } },
        {
          customer: {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          },
        },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    db.service.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
          },
        },
      },
      orderBy: { [sortBy || "createdAt"]: sortOrder || "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.service.count({ where }),
  ]);

  return { data, ...paginationMeta(total, params) };
}

export async function getServiceById(id: string) {
  return db.service.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          phone: true,
          companyName: true,
          kycStatus: true,
        },
      },
      product: {
        include: { category: true },
      },
      backups: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
}

export async function getServiceStats() {
  const [total, active, suspended, cancelled, expired, monthlyRevenue] =
    await Promise.all([
      db.service.count(),
      db.service.count({ where: { status: "ACTIVE" } }),
      db.service.count({ where: { status: "SUSPENDED" } }),
      db.service.count({ where: { status: "CANCELLED" } }),
      db.service.count({ where: { status: "EXPIRED" } }),
      db.service.aggregate({
        where: { status: "ACTIVE" },
        _sum: { amount: true },
      }),
    ]);

  return {
    total,
    active,
    suspended,
    cancelled,
    expired,
    monthlyRevenue: toNumber(monthlyRevenue._sum.amount),
  };
}

export async function getServicesByCustomer(customerId: string) {
  return db.service.findMany({
    where: { customerId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          category: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
