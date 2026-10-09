import type { Prisma } from "@prisma/client";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { domainEventState } from "@/lib/dal/domain-events";
import { eventLabel, getEventDefinition, isEventType } from "@/lib/events/catalog";
import { ApiError } from "../errors";
import { defineOperation } from "../operation";
import { decodeCursor, encodeCursor, keyset, pageOf, paginationQuery } from "../pagination";
import { dateTimeSchema } from "../schemas";

const TAG = "Events";

export const eventSchema = z.object({
  id: z.string(),
  type: z.string().describe('Katalog anahtarı, örn. "invoice.paid"'),
  label: z.string(),
  aggregateType: z.string(),
  aggregateId: z.string(),
  actorId: z.string().nullable(),
  occurredAt: dateTimeSchema,
  state: z.enum(["PROCESSED", "PENDING", "RETRYING", "FAILED"]).describe("Abonelere dağıtım durumu"),
  payload: z.record(z.string(), z.unknown()).describe("Olay verisi; hassas alanlar \"[redacted]\""),
});

const REDACTED = "[redacted]";

/** Catalogue-sensitive keys (stored encrypted) are never returned. */
export function redactPayload(type: string, payload: Prisma.JsonValue): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const sensitive = isEventType(type) ? (getEventDefinition(type).sensitive ?? []) : [];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    out[key] = sensitive.includes(key) || (typeof value === "string" && value.startsWith("enc:v1:")) ? REDACTED : value;
  }
  return out;
}

export const listEvents = defineOperation({
  id: "listEvents",
  method: "GET",
  path: "/events",
  tag: TAG,
  summary: "İş olaylarını listele (ajanlar için yoklama)",
  description: [
    "Outbox olayları (invoice.paid, service.suspended, ticket.replied …).",
    "Yoklama (polling): `order=asc` ile çağırın ve yanıttaki `pagination.nextCursor` değerini saklayın; bir sonraki çağrıda `cursor` olarak gönderin.",
    "`order=asc` iken `nextCursor` son sayfada da döner (yeni olay yoksa gönderdiğiniz cursor geri gelir), böylece kaldığınız yer kaybolmaz.",
    "İlk çağrı için `since` (ISO zaman) verebilirsiniz.",
  ].join(" "),
  permission: "activity.view",
  query: z.object({
    type: z.string().max(100).optional().describe('Olay türü, örn. "invoice.paid"; "invoice." gibi önek de olur'),
    aggregateType: z.string().max(50).optional().describe("Invoice, Service, Order, SupportTicket, Domain …"),
    aggregateId: z.string().max(64).optional(),
    since: z.iso.datetime({ offset: true }).optional().describe("Bu zamandan sonra oluşanlar"),
    order: z.enum(["asc", "desc"]).default("desc"),
    ...paginationQuery,
  }),
  response: eventSchema,
  list: true,
  handler: async ({ query }) => {
    if (query.cursor) decodeCursor(query.cursor);
    const page = keyset("occurredAt", query, query.order);
    const typeFilter: Prisma.DomainEventWhereInput = query.type
      ? query.type.endsWith(".")
        ? { type: { startsWith: query.type } }
        : { type: query.type }
      : {};
    const since = query.since ? new Date(query.since) : null;
    if (since && Number.isNaN(since.getTime())) throw new ApiError(422, "validation_failed", "Geçersiz since");
    const rows = await db.domainEvent.findMany({
      where: {
        AND: [
          typeFilter,
          query.aggregateType ? { aggregateType: query.aggregateType } : {},
          query.aggregateId ? { aggregateId: query.aggregateId } : {},
          since ? { occurredAt: { gt: since } } : {},
          page.where,
        ],
      },
      orderBy: page.orderBy,
      take: page.take,
      select: {
        id: true,
        type: true,
        aggregateType: true,
        aggregateId: true,
        actorId: true,
        occurredAt: true,
        processedAt: true,
        attempts: true,
        lastError: true,
        payload: true,
      },
    });
    const { items, pagination } = pageOf(rows, query.limit, (row) => row.occurredAt);
    if (query.order === "asc" && !pagination.nextCursor) {
      const last = items[items.length - 1];
      pagination.nextCursor = last ? encodeCursor(last.occurredAt, last.id) : (query.cursor ?? null);
    }
    return {
      data: items.map((row) => ({
        id: row.id,
        type: row.type,
        label: eventLabel(row.type),
        aggregateType: row.aggregateType,
        aggregateId: row.aggregateId,
        actorId: row.actorId,
        occurredAt: row.occurredAt.toISOString(),
        state: domainEventState(row),
        payload: redactPayload(row.type, row.payload),
      })),
      pagination,
    };
  },
});
