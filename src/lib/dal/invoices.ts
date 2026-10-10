import { db } from "@/lib/db";
import {
  type PaginationParams,
  paginationMeta,
} from "@/lib/utils/pagination";
import type { InvoiceStatus } from "@prisma/client";
import { sub, toNumber } from "@/lib/money";
import { pastDueInvoiceWhere } from "@/lib/billing/past-due";

interface GetInvoicesParams extends PaginationParams {
  status?: InvoiceStatus;
  customerId?: string;
  /** Unpaid and past the due date (OVERDUE + PENDING after dueDate), see src/lib/billing/past-due.ts. */
  pastDueAt?: Date;
}

export async function getInvoices(params: GetInvoicesParams) {
  const { page, perPage, search, sortBy, sortOrder, status, customerId, pastDueAt } =
    params;

  const where = {
    ...(pastDueAt && { AND: [pastDueInvoiceWhere(pastDueAt)] }),
    ...(status && { status }),
    ...(customerId && { customerId }),
    ...(search && {
      OR: [
        { invoiceNumber: { contains: search, mode: "insensitive" as const } },
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
    db.invoice.findMany({
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
        items: true,
        _count: {
          select: { payments: true },
        },
      },
      orderBy: { [sortBy || "createdAt"]: sortOrder || "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.invoice.count({ where }),
  ]);

  return { data, ...paginationMeta(total, params) };
}

export async function getInvoiceById(id: string) {
  return db.invoice.findUnique({
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
          taxNumber: true,
          taxOffice: true,
          address: true,
          city: true,
          country: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          serviceId: true,
        },
      },
      items: true,
      payments: {
        orderBy: { createdAt: "desc" },
      },
      eInvoiceRecord: {
        select: {
          status: true,
          type: true,
          documentNumber: true,
          documentUuid: true,
          provider: true,
          attempts: true,
          sentAt: true,
          errorMessage: true,
        },
      },
    },
  });
}

export async function getInvoiceStats() {
  const [total, pending, paid, overdue, totalAmount, paidAmount] =
    await Promise.all([
      db.invoice.count(),
      db.invoice.count({ where: { status: "PENDING" } }),
      db.invoice.count({ where: { status: "PAID" } }),
      db.invoice.count({ where: { status: "OVERDUE" } }),
      db.invoice.aggregate({ _sum: { totalAmount: true } }),
      db.invoice.aggregate({
        where: { status: "PAID" },
        _sum: { paidAmount: true },
      }),
    ]);

  return {
    total,
    pending,
    paid,
    overdue,
    totalAmount: toNumber(totalAmount._sum.totalAmount),
    paidAmount: toNumber(paidAmount._sum.paidAmount),
    unpaidAmount: toNumber(sub(totalAmount._sum.totalAmount, paidAmount._sum.paidAmount)),
  };
}

export async function getInvoicesByCustomer(customerId: string) {
  return db.invoice.findMany({
    where: { customerId },
    include: {
      items: true,
      eInvoiceRecord: {
        select: {
          status: true,
          type: true,
          sentAt: true,
        },
      },
      _count: {
        select: { payments: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
