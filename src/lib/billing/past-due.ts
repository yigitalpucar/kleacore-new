import type { Prisma } from "@prisma/client";

/**
 * Invoices whose due date has passed and that are still unpaid: those the
 * overdue job already marked OVERDUE, plus PENDING ones past their dueDate
 * that it has not marked yet (e.g. inside the grace period). Used by the admin
 * dashboard "vadesi geçmiş alacak" card and /yonetim/faturalar/gecikmis so
 * both count the same invoices.
 */
export function pastDueInvoiceWhere(now: Date): Prisma.InvoiceWhereInput {
  return {
    OR: [{ status: "OVERDUE" }, { status: "PENDING", dueDate: { lt: now } }],
  };
}
