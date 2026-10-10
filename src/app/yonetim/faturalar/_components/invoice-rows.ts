import type { getInvoices } from "@/lib/dal/invoices";
import { daysUntil } from "@/lib/format/date";

export type AdminInvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  /** KDV hariç. */
  subtotal: number;
  taxAmount: number;
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
    subtotal: Number(inv.subtotal),
    taxAmount: Number(inv.taxAmount),
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

const lower = (s: string | null | undefined) => (s ?? "").toLocaleLowerCase("tr-TR");

/** Search of the invoice tables (and their CSV export); `q` is already lower-cased. */
export function invoiceSearch(inv: AdminInvoiceRow, q: string) {
  return (
    lower(inv.invoiceNumber).includes(q) ||
    lower(inv.customer.name).includes(q) ||
    lower(inv.customer.email).includes(q) ||
    lower(inv.description).includes(q)
  );
}

/** Bekleyen: kritik 0–2 gün, yaklaşan 3–5, normal 6+. */
export function invoiceUrgency(r: Pick<AdminInvoiceRow, "daysToDue">) {
  if (r.daysToDue <= 2) return "critical";
  if (r.daysToDue <= 5) return "warning";
  return "normal";
}

/** Gecikmiş: 1–14 / 15–29 / 30+ gün. */
export function invoiceSeverity(r: Pick<AdminInvoiceRow, "daysToDue">) {
  const d = -r.daysToDue;
  if (d >= 30) return "severe";
  if (d >= 15) return "moderate";
  return "mild";
}

/** Filter id → row value, shared by the table filters and the CSV export. */
export const INVOICE_FILTER_VALUES: Record<string, (r: AdminInvoiceRow) => string> = {
  status: (r) => r.status,
  urgency: invoiceUrgency,
  severity: invoiceSeverity,
};
