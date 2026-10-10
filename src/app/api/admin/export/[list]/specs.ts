/**
 * CSV export of the admin lists (UI3 item 11). Each spec loads rows with the
 * same DAL query and row mapper the list page uses, then applies the same
 * filter and search functions as the table, so the file matches the
 * filtered view (across all server pages, not just the visible one).
 */
import type { CustomerType, InvoiceStatus, OrderStatus, ServiceStatus, TicketStatus, UserStatus } from "@prisma/client";
import { enumLabel, getStatusMeta } from "@/components/app/status-map";
import type { AdminListKey } from "@/lib/admin/list-views";
import { getCustomers } from "@/lib/dal/customers";
import { getInvoices } from "@/lib/dal/invoices";
import { getOrders } from "@/lib/dal/orders";
import { getServices } from "@/lib/dal/services";
import { getTickets } from "@/lib/dal/tickets";
import { billingPeriodLabel, formatDate, formatDateTime } from "@/lib/format/date";
import { csvAmount, type CsvAmount, type CsvCell } from "@/lib/reports/csv";
import { INVOICE_FILTER_VALUES, invoiceSearch, toAdminInvoiceRow, type AdminInvoiceRow } from "@/app/yonetim/faturalar/_components/invoice-rows";
import { SERVICE_FILTER_VALUES, serviceSearch, toServiceListRow, type ServiceListRow } from "@/app/yonetim/hizmetler/service-rows";
import { CUSTOMER_FILTER_VALUES, customerFullName, customerSearch, toCustomerRow, type CustomerRow } from "@/app/yonetim/musteriler/_components/customer-row";
import { ORDER_FILTER_VALUES, orderSearch, serializeOrder } from "@/app/yonetim/siparisler/_components/serialize";
import type { OrderRow } from "@/app/yonetim/siparisler/_components/order-list";
import { TICKET_FILTER_VALUES, ticketSearch, toAdminTicketRow, type AdminTicketRow } from "@/app/yonetim/destek/ticket-rows";

export const EXPORT_BATCH = 500;
/** Hard cap per file (100 batches). */
export const EXPORT_MAX_ROWS = 50_000;

type Cell = CsvCell | CsvAmount;

export interface ExportSpec<R> {
  fileName: string;
  /** Scope = which list page (status pages); value = extra DAL params. */
  scopes: Record<string, Record<string, string>>;
  filterValues: Record<string, (row: R) => string>;
  search: (row: R, q: string) => boolean;
  /** One DAL page (1-based) of rows for the scope (plus server-side narrowing from filters). */
  fetchPage: (params: Record<string, string>, page: number) => Promise<{ rows: R[]; totalPages: number }>;
  /** Filter values that can narrow the DAL query too (status enums). */
  narrow?: (filters: Record<string, string>) => Record<string, string>;
  header: string[];
  cells: (row: R) => Cell[];
}

const page = (n: number) => ({ page: n, perPage: EXPORT_BATCH });
const date = (v: string | null | undefined) => (v ? formatDate(v) : "");
const dateTime = (v: string | null | undefined) => (v ? formatDateTime(v) : "");
const status = (kind: Parameters<typeof getStatusMeta>[0], value: string, audience?: "admin") =>
  getStatusMeta(kind, value, audience).label;
const pick = (filters: Record<string, string>, map: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(map)
      .filter(([filterId]) => filters[filterId] && filters[filterId] !== "all")
      .map(([filterId, param]) => [param, filters[filterId]])
  );

const invoices: ExportSpec<AdminInvoiceRow> = {
  fileName: "faturalar",
  scopes: {
    all: {},
    pending: { status: "PENDING" },
    overdue: { status: "OVERDUE" },
    paid: { status: "PAID" },
    cancelled: { status: "CANCELLED" },
  },
  filterValues: INVOICE_FILTER_VALUES,
  search: invoiceSearch,
  narrow: (f) => pick(f, { status: "status" }),
  async fetchPage(params, n) {
    const now = new Date();
    const result = await getInvoices({ ...page(n), status: params.status as InvoiceStatus | undefined });
    return { rows: result.data.map((inv) => toAdminInvoiceRow(inv, now)), totalPages: result.totalPages };
  },
  header: ["Fatura no", "Müşteri", "E-posta", "Açıklama", "Durum", "Oluşturma", "Son ödeme", "Ödeme tarihi", "Ara toplam (KDV hariç)", "KDV", "Toplam", "Ödenen"],
  cells: (r) => [
    r.invoiceNumber,
    r.customer.name,
    r.customer.email,
    r.description,
    status("invoice", r.status),
    date(r.createdAt),
    date(r.dueDate),
    date(r.paidAt),
    csvAmount(r.subtotal),
    csvAmount(r.taxAmount),
    csvAmount(r.totalAmount),
    csvAmount(r.paidAmount),
  ],
};

const services: ExportSpec<ServiceListRow> = {
  fileName: "hizmetler",
  scopes: { all: {}, active: { status: "ACTIVE" }, suspended: { status: "SUSPENDED" }, cancelled: { status: "CANCELLED" } },
  filterValues: SERVICE_FILTER_VALUES,
  search: serviceSearch,
  narrow: (f) => pick(f, { status: "status" }),
  async fetchPage(params, n) {
    const result = await getServices({ ...page(n), status: params.status as ServiceStatus | undefined });
    return { rows: result.data.map(toServiceListRow), totalPages: result.totalPages };
  },
  header: ["Hizmet ID", "Hizmet", "Ürün", "Müşteri", "E-posta", "Durum", "Dönem", "Dönem tutarı (KDV hariç)", "Yenileme", "IP", "Sunucu", "Askı nedeni", "Oluşturma"],
  cells: (r) => [
    r.id,
    r.domain || r.label || r.product.name,
    r.product.name,
    r.customer.name,
    r.customer.email,
    status("service", r.status),
    billingPeriodLabel(r.billingPeriod),
    csvAmount(r.amount),
    date(r.nextDueDate),
    r.ipAddress,
    r.serverName,
    r.suspendReason,
    date(r.createdAt),
  ],
};

const customers: ExportSpec<CustomerRow> = {
  fileName: "musteriler",
  scopes: {
    all: {},
    individual: { customerType: "INDIVIDUAL" },
    corporate: { customerType: "CORPORATE" },
    suspended: { status: "SUSPENDED" },
    closed: { status: "CLOSED" },
  },
  filterValues: CUSTOMER_FILTER_VALUES,
  search: customerSearch,
  narrow: (f) => pick(f, { status: "status", type: "customerType" }),
  async fetchPage(params, n) {
    const result = await getCustomers({
      ...page(n),
      status: params.status as UserStatus | undefined,
      customerType: params.customerType as CustomerType | undefined,
    });
    return { rows: result.data.map(toCustomerRow), totalPages: result.totalPages };
  },
  header: ["Müşteri ID", "Ad soyad", "E-posta", "Telefon", "Tip", "Firma", "Durum", "Bakiye", "Sipariş", "Hizmet", "Destek talebi", "Kayıt"],
  cells: (r) => [
    r.id,
    customerFullName(r),
    r.email,
    r.phone,
    enumLabel("customerType", r.customerType ?? "INDIVIDUAL"),
    r.companyName,
    status("user", r.status),
    csvAmount(r.balance),
    r.orders,
    r.services,
    r.tickets,
    date(r.createdAt),
  ],
};

const orders: ExportSpec<OrderRow> = {
  fileName: "siparisler",
  scopes: { all: {}, pending: { status: "PENDING" }, processing: { status: "PROCESSING" }, cancelled: { status: "CANCELLED" } },
  filterValues: ORDER_FILTER_VALUES,
  search: orderSearch,
  narrow: (f) => pick(f, { status: "status" }),
  async fetchPage(params, n) {
    const result = await getOrders({ ...page(n), status: params.status as OrderStatus | undefined });
    return { rows: result.data.map(serializeOrder), totalPages: result.totalPages };
  },
  header: ["Sipariş no", "Müşteri", "E-posta", "Ürün", "Durum", "Tutar", "Tarih", "İptal tarihi", "İptal nedeni"],
  cells: (r) => [
    r.orderNumber,
    `${r.customer.name} ${r.customer.surname}`.trim(),
    r.customer.email,
    r.product.name,
    status("order", r.status),
    csvAmount(r.totalAmount),
    date(String(r.createdAt)),
    date(r.cancelledAt ? String(r.cancelledAt) : null),
    r.cancellationReason,
  ],
};

const tickets: ExportSpec<AdminTicketRow> = {
  fileName: "destek-talepleri",
  scopes: { all: {} },
  filterValues: TICKET_FILTER_VALUES,
  search: ticketSearch,
  narrow: (f) => pick(f, { status: "status", priority: "priority", department: "department" }),
  async fetchPage(params, n) {
    const result = await getTickets({
      ...page(n),
      status: params.status as TicketStatus | undefined,
      priority: params.priority as Parameters<typeof getTickets>[0]["priority"],
      department: params.department as Parameters<typeof getTickets>[0]["department"],
    });
    return { rows: result.data.map(toAdminTicketRow), totalPages: result.totalPages };
  },
  header: ["Talep no", "Konu", "Müşteri", "E-posta", "Departman", "Öncelik", "Durum", "Mesaj", "Açılış", "Son hareket"],
  cells: (r) => [
    r.ticketNumber,
    r.subject,
    r.customer.name,
    r.customer.email,
    enumLabel("ticketDepartment", r.department),
    status("ticketPriority", r.priority),
    status("ticket", r.status, "admin"),
    r.messageCount,
    dateTime(r.createdAt),
    dateTime(r.updatedAt),
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EXPORT_SPECS: Record<AdminListKey, ExportSpec<any>> = { invoices, services, customers, orders, tickets };

/** Keeps a row when every non-"all" filter matches and the search (if any) does. */
export function matchesView<R>(spec: Pick<ExportSpec<R>, "filterValues" | "search">, row: R, filters: Record<string, string>, q: string) {
  for (const [id, value] of Object.entries(filters)) {
    if (!value || value === "all") continue;
    const get = spec.filterValues[id];
    if (get && get(row) !== value) return false;
  }
  return q ? spec.search(row, q) : true;
}
