import type { Prisma } from "@prisma/client";
import { z } from "zod/v4";
import { createInvoiceAs, fulfillInvoiceAsAdmin, sendInvoiceReminderFor } from "@/lib/billing/admin-invoices";
import { db } from "@/lib/db";
import { ApiError, failure } from "../errors";
import { defineOperation } from "../operation";
import { keyset, pageOf, paginationQuery } from "../pagination";
import { dateTimeSchema, decimal, idParams, idSchema, iso, moneySchema } from "../schemas";

const TAG = "Invoices";
const INVOICE_STATUSES = ["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"] as const;

const invoiceSelect = {
  id: true,
  invoiceNumber: true,
  customerId: true,
  orderId: true,
  subtotal: true,
  taxRate: true,
  taxAmount: true,
  totalAmount: true,
  paidAmount: true,
  refundedAmount: true,
  status: true,
  issuedAt: true,
  dueDate: true,
  paidAt: true,
  notes: true,
  createdAt: true,
  customer: { select: { email: true, name: true, surname: true } },
} satisfies Prisma.InvoiceSelect;

type InvoiceRow = Prisma.InvoiceGetPayload<{ select: typeof invoiceSelect }>;

export const invoiceSchema = z.object({
  id: z.string(),
  invoiceNumber: z.string(),
  customerId: z.string(),
  customer: z.object({ email: z.string(), name: z.string() }),
  orderId: z.string().nullable(),
  subtotal: moneySchema,
  taxRate: moneySchema.describe("KDV oranı (yüzde)"),
  taxAmount: moneySchema,
  totalAmount: moneySchema,
  paidAmount: moneySchema,
  refundedAmount: moneySchema,
  status: z.enum(INVOICE_STATUSES),
  issuedAt: dateTimeSchema,
  dueDate: dateTimeSchema,
  paidAt: dateTimeSchema.nullable(),
  notes: z.string().nullable(),
  createdAt: dateTimeSchema,
});

function serializeInvoice(row: InvoiceRow): z.infer<typeof invoiceSchema> {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    customerId: row.customerId,
    customer: { email: row.customer.email, name: `${row.customer.name} ${row.customer.surname}`.trim() },
    orderId: row.orderId,
    subtotal: decimal(row.subtotal)!,
    taxRate: decimal(row.taxRate)!,
    taxAmount: decimal(row.taxAmount)!,
    totalAmount: decimal(row.totalAmount)!,
    paidAmount: decimal(row.paidAmount)!,
    refundedAmount: decimal(row.refundedAmount)!,
    status: row.status,
    issuedAt: row.issuedAt.toISOString(),
    dueDate: row.dueDate.toISOString(),
    paidAt: iso(row.paidAt),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

const invoiceDetailSchema = invoiceSchema.extend({
  items: z.array(z.object({ id: z.string(), description: z.string(), quantity: z.number().int(), unitPrice: moneySchema, totalPrice: moneySchema })),
  payments: z.array(
    z.object({
      id: z.string(),
      amount: moneySchema,
      method: z.string(),
      status: z.string(),
      transactionId: z.string().nullable(),
      paidAt: dateTimeSchema.nullable(),
      createdAt: dateTimeSchema,
    })
  ),
});

async function loadInvoiceDetail(id: string): Promise<z.infer<typeof invoiceDetailSchema>> {
  const row = await db.invoice.findUnique({
    where: { id },
    select: {
      ...invoiceSelect,
      items: { select: { id: true, description: true, quantity: true, unitPrice: true, totalPrice: true }, orderBy: { id: "asc" } },
      payments: {
        select: { id: true, amount: true, method: true, status: true, transactionId: true, paidAt: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!row) throw new ApiError(404, "not_found", "Fatura bulunamadı");
  return {
    ...serializeInvoice(row),
    items: row.items.map((item) => ({ ...item, unitPrice: decimal(item.unitPrice)!, totalPrice: decimal(item.totalPrice)! })),
    payments: row.payments.map((payment) => ({
      ...payment,
      amount: decimal(payment.amount)!,
      paidAt: iso(payment.paidAt),
      createdAt: payment.createdAt.toISOString(),
    })),
  };
}

export const listInvoices = defineOperation({
  id: "listInvoices",
  method: "GET",
  path: "/invoices",
  tag: TAG,
  summary: "Faturaları listele",
  permission: "invoices.view",
  query: z.object({
    status: z.enum(INVOICE_STATUSES).optional(),
    customerId: idSchema.optional(),
    q: z.string().trim().max(100).optional().describe("Fatura numarasında arar"),
    ...paginationQuery,
  }),
  response: invoiceSchema,
  list: true,
  handler: async ({ query }) => {
    const page = keyset("createdAt", query);
    const rows = await db.invoice.findMany({
      where: {
        AND: [
          query.status ? { status: query.status } : {},
          query.customerId ? { customerId: query.customerId } : {},
          query.q ? { invoiceNumber: { contains: query.q, mode: "insensitive" } } : {},
          page.where,
        ],
      },
      orderBy: page.orderBy,
      take: page.take,
      select: invoiceSelect,
    });
    const { items, pagination } = pageOf(rows, query.limit, (row) => row.createdAt);
    return { data: items.map(serializeInvoice), pagination };
  },
});

export const getInvoice = defineOperation({
  id: "getInvoice",
  method: "GET",
  path: "/invoices/{id}",
  tag: TAG,
  summary: "Fatura detayı (kalemler, ödemeler)",
  permission: "invoices.view",
  params: idParams,
  response: invoiceDetailSchema,
  handler: async ({ params }) => ({ data: await loadInvoiceDetail(params.id) }),
});

export const createInvoice = defineOperation({
  id: "createInvoice",
  method: "POST",
  path: "/invoices",
  tag: TAG,
  summary: "Fatura oluştur",
  description:
    "Ara toplam, KDV ve toplam sunucuda kalemlerden hesaplanır (birim fiyatlar KDV hariç). Müşteriye \"fatura oluştu\" bildirimi gider. Idempotency-Key önerilir.",
  permission: "invoices.edit",
  body: z.object({
    customerId: idSchema,
    orderId: idSchema.optional(),
    taxRate: z.number().min(0).max(100).optional().describe("Varsayılan 20"),
    dueDate: z.iso.date().or(z.iso.datetime()).describe("Son ödeme tarihi (YYYY-MM-DD veya ISO zaman)"),
    notes: z.string().trim().max(2000).optional(),
    items: z
      .array(
        z.object({
          description: z.string().trim().min(1).max(500),
          quantity: z.number().int().min(1).max(10_000),
          unitPrice: z.union([z.number().min(0), z.string().regex(/^\d+(\.\d{1,2})?$/)]).describe("KDV hariç birim fiyat"),
        })
      )
      .min(1)
      .max(100),
  }),
  response: invoiceDetailSchema,
  successStatus: 201,
  handler: async ({ body, context }) => {
    const result = await createInvoiceAs(context.owner.id, body);
    if (!result.success) throw failure(result);
    return { data: await loadInvoiceDetail(result.data.id) };
  },
});

export const markInvoicePaid = defineOperation({
  id: "markInvoicePaid",
  method: "POST",
  path: "/invoices/{id}/mark-paid",
  tag: TAG,
  summary: "Ödendi olarak işaretle (manuel ödeme kaydıyla)",
  description:
    "Kalan tutar için manuel bir ödeme kaydı (yöntem + referans) oluşturur ve faturayı normal tahsilat akışından geçirir: sipariş aktivasyonu, yenileme, e-fatura ve \"ödeme alındı\" bildirimi bir ödeme geri çağrısındaki gibi çalışır. Aynı referans aynı faturada ikinci kez kullanılamaz.",
  permission: "invoices.edit",
  params: idParams,
  body: z.object({
    method: z.enum(["BANK_TRANSFER", "CREDIT_CARD"]).default("BANK_TRANSFER"),
    reference: z.string().trim().min(1).max(120).optional().describe("Dekont / işlem numarası"),
    notes: z.string().trim().max(500).optional(),
  }),
  response: z.object({
    invoice: invoiceDetailSchema,
    paymentId: z.string().nullable(),
    warning: z.string().nullable().describe("Ödeme kaydedildi ama sipariş aktivasyonu yöneticiye düştüyse"),
  }),
  handler: async ({ params, body, context }) => {
    const result = await fulfillInvoiceAsAdmin(params.id, context.owner.id, body.notes ?? `Admin API ödeme kaydı (${context.token.name})`, {
      method: body.method,
      reference: body.reference,
    });
    if (!result.success) throw failure(result);
    return {
      data: { invoice: await loadInvoiceDetail(params.id), paymentId: result.paymentId ?? null, warning: result.warning ?? null },
    };
  },
});

export const sendInvoiceReminder = defineOperation({
  id: "sendInvoiceReminder",
  method: "POST",
  path: "/invoices/{id}/send-reminder",
  tag: TAG,
  summary: "Ödeme hatırlatması gönder",
  description: "Vadesi geçmişse gecikme bildirimi, değilse ödeme hatırlatması e-postası.",
  permission: "invoices.edit",
  params: idParams,
  body: z.object({}).optional(),
  response: z.object({ sent: z.boolean(), message: z.string() }),
  handler: async ({ params }) => {
    const result = await sendInvoiceReminderFor(params.id);
    if (!result.success) throw failure(result);
    return { data: { sent: true, message: result.message } };
  },
});
