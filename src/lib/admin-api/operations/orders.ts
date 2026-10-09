import type { Prisma } from "@prisma/client";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { approveOrderAs } from "@/lib/orders/approve";
import { FraudReviewError, approveFraudReview } from "@/lib/fraud/review";
import { HOLD_REASONS } from "@/lib/provisioning/hold";
import { ApiError, failure } from "../errors";
import { defineOperation } from "../operation";
import { keyset, pageOf, paginationQuery } from "../pagination";
import { dateTimeSchema, decimal, idParams, idSchema, iso, moneySchema } from "../schemas";

const TAG = "Orders";
const ORDER_STATUSES = ["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "CANCELLED", "REFUNDED"] as const;

const orderSelect = {
  id: true,
  orderNumber: true,
  customerId: true,
  productId: true,
  domain: true,
  billingPeriod: true,
  quantity: true,
  taxAmount: true,
  totalAmount: true,
  status: true,
  approvedAt: true,
  completedAt: true,
  cancelledAt: true,
  cancellationReason: true,
  serviceId: true,
  customerNotes: true,
  createdAt: true,
  provisioningHeldAt: true,
  provisioningHoldReasons: true,
  fraudCheck: { select: { status: true, score: true } },
  product: { select: { name: true } },
  customer: { select: { email: true, name: true, surname: true } },
  invoice: { select: { id: true, invoiceNumber: true, status: true } },
} satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

export const orderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  customerId: z.string(),
  customer: z.object({ email: z.string(), name: z.string() }),
  productId: z.string(),
  productName: z.string(),
  domain: z.string().nullable(),
  billingPeriod: z.string(),
  quantity: z.number().int(),
  taxAmount: moneySchema,
  totalAmount: moneySchema.describe("KDV dahil"),
  status: z.enum(ORDER_STATUSES),
  approvedAt: dateTimeSchema.nullable(),
  completedAt: dateTimeSchema.nullable(),
  cancelledAt: dateTimeSchema.nullable(),
  cancellationReason: z.string().nullable(),
  serviceId: z.string().nullable(),
  invoice: z.object({ id: z.string(), invoiceNumber: z.string(), status: z.string() }).nullable(),
  customerNotes: z.string().nullable(),
  createdAt: dateTimeSchema,
  provisioningHold: z
    .object({ since: dateTimeSchema, reasons: z.array(z.enum(HOLD_REASONS)) })
    .nullable()
    .describe("Ödeme alındı ama kurulum bekletiliyor (risk incelemesi / kimlik doğrulaması)"),
  fraudCheck: z
    .object({ status: z.enum(["PASSED", "REVIEW", "APPROVED", "REJECTED"]), score: z.number().int() })
    .nullable(),
});

function serializeOrder(row: OrderRow): z.infer<typeof orderSchema> {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    customerId: row.customerId,
    customer: { email: row.customer.email, name: `${row.customer.name} ${row.customer.surname}`.trim() },
    productId: row.productId,
    productName: row.product.name,
    domain: row.domain,
    billingPeriod: row.billingPeriod,
    quantity: row.quantity,
    taxAmount: decimal(row.taxAmount)!,
    totalAmount: decimal(row.totalAmount)!,
    status: row.status,
    approvedAt: iso(row.approvedAt),
    completedAt: iso(row.completedAt),
    cancelledAt: iso(row.cancelledAt),
    cancellationReason: row.cancellationReason,
    serviceId: row.serviceId,
    invoice: row.invoice,
    customerNotes: row.customerNotes,
    createdAt: row.createdAt.toISOString(),
    provisioningHold: row.provisioningHeldAt
      ? {
          since: row.provisioningHeldAt.toISOString(),
          reasons: row.provisioningHoldReasons.filter((reason): reason is (typeof HOLD_REASONS)[number] =>
            (HOLD_REASONS as readonly string[]).includes(reason)
          ),
        }
      : null,
    fraudCheck: row.fraudCheck,
  };
}

const orderDetailSchema = orderSchema.extend({
  items: z.array(z.object({ productName: z.string(), quantity: z.number().int(), unitPrice: moneySchema, totalPrice: moneySchema })),
  activities: z.array(z.object({ action: z.string(), description: z.string(), performedBy: z.string(), createdAt: dateTimeSchema })),
});

async function loadOrderDetail(id: string): Promise<z.infer<typeof orderDetailSchema>> {
  const row = await db.order.findUnique({
    where: { id },
    select: {
      ...orderSelect,
      items: { select: { productName: true, quantity: true, unitPrice: true, totalPrice: true } },
      activities: { select: { action: true, description: true, performedBy: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) throw new ApiError(404, "not_found", "Sipariş bulunamadı");
  return {
    ...serializeOrder(row),
    items: row.items.map((item) => ({ ...item, unitPrice: decimal(item.unitPrice)!, totalPrice: decimal(item.totalPrice)! })),
    activities: row.activities.map((activity) => ({ ...activity, createdAt: activity.createdAt.toISOString() })),
  };
}

export const listOrders = defineOperation({
  id: "listOrders",
  method: "GET",
  path: "/orders",
  tag: TAG,
  summary: "Siparişleri listele",
  description: "`status=PENDING` onay bekleyen siparişleri verir.",
  permission: "orders.view",
  query: z.object({
    status: z.enum(ORDER_STATUSES).optional(),
    customerId: idSchema.optional(),
    q: z.string().trim().max(100).optional().describe("Sipariş numarası veya alan adında arar"),
    ...paginationQuery,
  }),
  response: orderSchema,
  list: true,
  handler: async ({ query }) => {
    const page = keyset("createdAt", query);
    const rows = await db.order.findMany({
      where: {
        AND: [
          query.status ? { status: query.status } : {},
          query.customerId ? { customerId: query.customerId } : {},
          query.q
            ? { OR: [{ orderNumber: { contains: query.q, mode: "insensitive" } }, { domain: { contains: query.q, mode: "insensitive" } }] }
            : {},
          page.where,
        ],
      },
      orderBy: page.orderBy,
      take: page.take,
      select: orderSelect,
    });
    const { items, pagination } = pageOf(rows, query.limit, (row) => row.createdAt);
    return { data: items.map(serializeOrder), pagination };
  },
});

export const getOrder = defineOperation({
  id: "getOrder",
  method: "GET",
  path: "/orders/{id}",
  tag: TAG,
  summary: "Sipariş detayı (kalemler, işlem geçmişi)",
  permission: "orders.view",
  params: idParams,
  response: orderDetailSchema,
  handler: async ({ params }) => ({ data: await loadOrderDetail(params.id) }),
});

export const approveOrder = defineOperation({
  id: "approveOrder",
  method: "POST",
  path: "/orders/{id}/approve",
  tag: TAG,
  summary: "Bekleyen siparişi onayla",
  description: "PENDING → APPROVED ve 7 gün vadeli fatura oluşturur (panelde \"Onayla\" ile aynı).",
  permission: "orders.manage",
  params: idParams,
  body: z.object({}).optional(),
  response: z.object({ order: orderDetailSchema, invoiceId: z.string() }),
  handler: async ({ params, context }) => {
    const result = await approveOrderAs(context.owner.id, params.id);
    if (!result.success) throw failure(result);
    return { data: { order: await loadOrderDetail(params.id), invoiceId: result.data.invoiceId } };
  },
});

export const approveOrderReview = defineOperation({
  id: "approveOrderReview",
  method: "POST",
  path: "/orders/{id}/review/approve",
  tag: TAG,
  summary: "Risk incelemesindeki siparişi onayla",
  description:
    "İnceleme kuyruğundaki (FraudCheck REVIEW) siparişi onaylar; panelde \"İnceleme → Onayla\" ile aynı yol. Ödenmiş ve bekletilen sipariş kurulum kuyruğuna bir kez alınır; kimlik doğrulaması hâlâ gerekiyorsa beklemede kalır. Tekrar denemelerde `Idempotency-Key` kullanın.",
  permission: "orders.manage",
  params: idParams,
  body: z.object({ note: z.string().trim().max(1000).optional() }).optional(),
  response: z.object({
    order: orderDetailSchema,
    paid: z.boolean(),
    released: z.boolean().describe("Kurulum bu istekle başlatıldıysa true"),
    stillHeldFor: z.array(z.enum(HOLD_REASONS)),
  }),
  handler: async ({ params, body, context }) => {
    let outcome: Awaited<ReturnType<typeof approveFraudReview>>;
    try {
      outcome = await approveFraudReview({ orderId: params.id, reviewerId: context.owner.id, note: body?.note });
    } catch (error) {
      if (error instanceof FraudReviewError) throw new ApiError(409, "conflict", error.message);
      throw error;
    }
    const release = outcome.release;
    return {
      data: {
        order: await loadOrderDetail(params.id),
        paid: outcome.paid,
        released: release?.released === true,
        stillHeldFor: release && !release.released ? release.reasons : [],
      },
    };
  },
});
