import { db } from "@/lib/db";
import {
  type PaginationParams,
  paginationMeta,
} from "@/lib/utils/pagination";
import type { PaymentMethod, PaymentStatus } from "@prisma/client";

interface GetPaymentsParams extends PaginationParams {
  status?: PaymentStatus;
  method?: PaymentMethod;
  customerId?: string;
}

export async function getPayments(params: GetPaymentsParams) {
  const { page, perPage, search, sortBy, sortOrder, status, method, customerId } =
    params;

  const where = {
    ...(status && { status }),
    ...(method && { method }),
    ...(customerId && { customerId }),
    ...(search && {
      OR: [
        { invoice: { invoiceNumber: { contains: search, mode: "insensitive" as const } } },
        { customer: { name: { contains: search, mode: "insensitive" as const } } },
        { customer: { email: { contains: search, mode: "insensitive" as const } } },
        { transactionId: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    db.payment.findMany({
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
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
          },
        },
      },
      orderBy: { [sortBy || "createdAt"]: sortOrder || "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.payment.count({ where }),
  ]);

  return { data, ...paginationMeta(total, params) };
}

export async function getPaymentsByInvoice(invoiceId: string) {
  return db.payment.findMany({
    where: { invoiceId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPaymentsByCustomer(customerId: string) {
  return db.payment.findMany({
    where: { customerId },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPaymentStats(customerId?: string) {
  const where = customerId ? { customerId } : {};

  const [total, completed, pending, failed, refunded, totalAmount, completedAmount] =
    await Promise.all([
      db.payment.count({ where }),
      db.payment.count({ where: { ...where, status: "COMPLETED" } }),
      db.payment.count({ where: { ...where, status: "PENDING" } }),
      db.payment.count({ where: { ...where, status: "FAILED" } }),
      db.payment.count({ where: { ...where, status: "REFUNDED" } }),
      db.payment.aggregate({ where, _sum: { amount: true } }),
      db.payment.aggregate({
        where: { ...where, status: "COMPLETED" },
        _sum: { amount: true },
      }),
    ]);

  return {
    total,
    completed,
    pending,
    failed,
    refunded,
    totalAmount: totalAmount._sum.amount ?? 0,
    completedAmount: completedAmount._sum.amount ?? 0,
  };
}

export async function getPaymentById(id: string) {
  return db.payment.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          phone: true,
        },
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          paidAmount: true,
          status: true,
          dueDate: true,
          issuedAt: true,
        },
      },
    },
  });
}
