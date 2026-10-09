import type { Prisma } from "@prisma/client";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { MAX_MESSAGE_LENGTH } from "@/lib/support/tickets";
import { addStaffReply, closeTicketByStaff } from "@/lib/support/web";
import { ApiError, failure } from "../errors";
import { defineOperation } from "../operation";
import { keyset, pageOf, paginationQuery } from "../pagination";
import { dateTimeSchema, idParams, idSchema, iso } from "../schemas";

const TAG = "Tickets";
const TICKET_STATUSES = ["OPEN", "CUSTOMER_REPLY", "ADMIN_REPLY", "WAITING", "CLOSED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const DEPARTMENTS = ["GENERAL", "TECHNICAL", "BILLING", "SALES"] as const;

const ticketSelect = {
  id: true,
  ticketNumber: true,
  customerId: true,
  guestEmail: true,
  guestName: true,
  source: true,
  subject: true,
  department: true,
  priority: true,
  status: true,
  assignedTo: true,
  relatedServiceId: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { email: true, name: true, surname: true } },
} satisfies Prisma.SupportTicketSelect;

type TicketRow = Prisma.SupportTicketGetPayload<{ select: typeof ticketSelect }>;

export const ticketSchema = z.object({
  id: z.string(),
  ticketNumber: z.string(),
  customerId: z.string().nullable(),
  requester: z.object({ email: z.string().nullable(), name: z.string().nullable() }),
  source: z.string(),
  subject: z.string(),
  department: z.enum(DEPARTMENTS),
  priority: z.enum(PRIORITIES),
  status: z.enum(TICKET_STATUSES),
  assignedTo: z.string().nullable(),
  relatedServiceId: z.string().nullable(),
  closedAt: dateTimeSchema.nullable(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

function serializeTicket(row: TicketRow): z.infer<typeof ticketSchema> {
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    customerId: row.customerId,
    requester: row.customer
      ? { email: row.customer.email, name: `${row.customer.name} ${row.customer.surname}`.trim() }
      : { email: row.guestEmail, name: row.guestName },
    source: row.source,
    subject: row.subject,
    department: row.department,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assignedTo,
    relatedServiceId: row.relatedServiceId,
    closedAt: iso(row.closedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const ticketDetailSchema = ticketSchema.extend({
  messages: z.array(
    z.object({
      id: z.string(),
      senderName: z.string(),
      senderRole: z.string().describe("CUSTOMER veya personel rolü"),
      message: z.string(),
      source: z.string(),
      attachments: z.array(z.object({ id: z.string(), fileName: z.string(), size: z.number().int() })),
      createdAt: dateTimeSchema,
    })
  ),
});

async function loadTicketDetail(id: string): Promise<z.infer<typeof ticketDetailSchema>> {
  const row = await db.supportTicket.findUnique({
    where: { id },
    select: {
      ...ticketSelect,
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          senderName: true,
          senderRole: true,
          message: true,
          source: true,
          createdAt: true,
          files: { select: { id: true, fileName: true, sizeBytes: true } },
        },
      },
    },
  });
  if (!row) throw new ApiError(404, "not_found", "Destek talebi bulunamadı");
  return {
    ...serializeTicket(row),
    messages: row.messages.map((message) => ({
      id: message.id,
      senderName: message.senderName,
      senderRole: message.senderRole,
      message: message.message,
      source: message.source,
      attachments: message.files.map((file) => ({ id: file.id, fileName: file.fileName, size: file.sizeBytes })),
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

export const listTickets = defineOperation({
  id: "listTickets",
  method: "GET",
  path: "/tickets",
  tag: TAG,
  summary: "Destek taleplerini listele",
  description: "`open=true` kapalı olmayanları verir; `status=CUSTOMER_REPLY` yanıt bekleyenleri.",
  permission: "tickets.view",
  query: z.object({
    status: z.enum(TICKET_STATUSES).optional(),
    open: z.enum(["true", "false"]).optional().transform((value) => (value === undefined ? undefined : value === "true")),
    priority: z.enum(PRIORITIES).optional(),
    department: z.enum(DEPARTMENTS).optional(),
    customerId: idSchema.optional(),
    q: z.string().trim().max(200).optional().describe("Konu veya talep numarasında arar"),
    ...paginationQuery,
  }),
  response: ticketSchema,
  list: true,
  handler: async ({ query }) => {
    const page = keyset("createdAt", query);
    const rows = await db.supportTicket.findMany({
      where: {
        AND: [
          query.status ? { status: query.status } : {},
          query.open === undefined ? {} : query.open ? { status: { not: "CLOSED" } } : { status: "CLOSED" },
          query.priority ? { priority: query.priority } : {},
          query.department ? { department: query.department } : {},
          query.customerId ? { customerId: query.customerId } : {},
          query.q
            ? { OR: [{ subject: { contains: query.q, mode: "insensitive" } }, { ticketNumber: { contains: query.q, mode: "insensitive" } }] }
            : {},
          page.where,
        ],
      },
      orderBy: page.orderBy,
      take: page.take,
      select: ticketSelect,
    });
    const { items, pagination } = pageOf(rows, query.limit, (row) => row.createdAt);
    return { data: items.map(serializeTicket), pagination };
  },
});

export const getTicket = defineOperation({
  id: "getTicket",
  method: "GET",
  path: "/tickets/{id}",
  tag: TAG,
  summary: "Destek talebi + mesajlar",
  description: "Ek dosyaların yalnız meta bilgisi döner (indirme panelden).",
  permission: "tickets.view",
  params: idParams,
  response: ticketDetailSchema,
  handler: async ({ params }) => ({ data: await loadTicketDetail(params.id) }),
});

export const replyToTicket = defineOperation({
  id: "replyToTicket",
  method: "POST",
  path: "/tickets/{id}/reply",
  tag: TAG,
  summary: "Talebe yanıt yaz (token sahibi adına)",
  description:
    "Yanıt token sahibinin adıyla gönderilir ve müşteriye bildirilir. `status`: ADMIN_REPLY (varsayılan), WAITING (müşteri yanıtı bekleniyor) veya CLOSED (yanıtla ve kapat). Idempotency-Key ile tekrar gönderimde çift mesaj oluşmaz.",
  permission: "tickets.reply",
  params: idParams,
  body: z.object({
    message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
    status: z.enum(["ADMIN_REPLY", "WAITING", "CLOSED"]).default("ADMIN_REPLY"),
  }),
  response: ticketDetailSchema,
  successStatus: 201,
  handler: async ({ params, body, context }) => {
    const result = await addStaffReply(
      { id: context.owner.id, role: context.owner.role },
      params.id,
      body.message,
      body.status,
      [],
      "API"
    );
    if (!result.success) throw failure(result);
    return { data: await loadTicketDetail(params.id) };
  },
});

export const closeTicket = defineOperation({
  id: "closeTicket",
  method: "POST",
  path: "/tickets/{id}/close",
  tag: TAG,
  summary: "Talebi kapat",
  permission: "tickets.reply",
  params: idParams,
  body: z.object({}).optional(),
  response: ticketSchema,
  handler: async ({ params }) => {
    const result = await closeTicketByStaff(params.id);
    if (!result.success) throw failure(result);
    const row = await db.supportTicket.findUnique({ where: { id: params.id }, select: ticketSelect });
    if (!row) throw new ApiError(404, "not_found", "Destek talebi bulunamadı");
    return { data: serializeTicket(row) };
  },
});
