import { db } from "@/lib/db";
import {
  type PaginationParams,
  paginationMeta,
} from "@/lib/utils/pagination";
import type { OrderStatus } from "@prisma/client";

interface GetOrdersParams extends PaginationParams {
  status?: OrderStatus;
  customerId?: string;
}

export async function getOrders(params: GetOrdersParams) {
  const { page, perPage, search, sortBy, sortOrder, status, customerId } =
    params;

  const where = {
    ...(status && { status }),
    ...(customerId && { customerId }),
    ...(search && {
      OR: [
        { orderNumber: { contains: search, mode: "insensitive" as const } },
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
    db.order.findMany({
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
        items: true,
      },
      orderBy: { [sortBy || "createdAt"]: sortOrder || "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.order.count({ where }),
  ]);

  return { data, ...paginationMeta(total, params) };
}

export async function getOrderById(id: string) {
  return db.order.findUnique({
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
          customerType: true,
        },
      },
      product: {
        include: { category: true },
      },
      items: true,
      activities: {
        orderBy: { createdAt: "desc" },
      },
      invoice: true,
      promoCode: true,
    },
  });
}

export async function getOrderStats() {
  const [total, pending, processing, completed, cancelled, revenue] =
    await Promise.all([
      db.order.count(),
      db.order.count({ where: { status: "PENDING" } }),
      db.order.count({ where: { status: "PROCESSING" } }),
      db.order.count({ where: { status: "COMPLETED" } }),
      db.order.count({ where: { status: "CANCELLED" } }),
      db.order.aggregate({
        where: { status: "COMPLETED" },
        _sum: { totalAmount: true },
      }),
    ]);

  return {
    total,
    pending,
    processing,
    completed,
    cancelled,
    totalRevenue: revenue._sum.totalAmount ?? 0,
  };
}

export async function getOrdersByCustomer(customerId: string) {
  return db.order.findMany({
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
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
