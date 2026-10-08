import type { getInvoices } from "@/lib/dal/invoices";
import { daysUntil } from "@/lib/format/date";

export type AdminInvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  createdAt: string;
  dueDate: string;
  paidAt: string | null;
  updatedAt: string;
  /** Days until the due date (negative when overdue), computed on the server. */
  daysToDue: number;
  description: string | null;
  customer: { id: string; name: string; email: string };
};

type InvoiceListItem = Awaited<ReturnType<typeof getInvoices>>["data"][number];

/** Prisma invoice (with customer + items) → plain row for the admin tables. */
export function toAdminInvoiceRow(inv: InvoiceListItem, now = new Date()): AdminInvoiceRow {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    totalAmount: Number(inv.totalAmount),
    paidAmount: Number(inv.paidAmount),
    createdAt: inv.createdAt.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
    updatedAt: inv.updatedAt.toISOString(),
    daysToDue: daysUntil(inv.dueDate, now) ?? 0,
    description: inv.items[0]?.description ?? null,
    customer: {
      id: inv.customer.id,
      name: `${inv.customer.name} ${inv.customer.surname}`.trim(),
      email: inv.customer.email,
    },
  };
}

/** List pages show 100 rows per server page unless `?perPage=` is given. */
export function withListPageSize(
  sp: Record<string, string | string[] | undefined>,
  params: { perPage: number }
) {
  return sp.perPage ? params.perPage : 100;
}
