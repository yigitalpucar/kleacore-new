import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getEventDefinition, isEventType } from "@/lib/events/catalog";
import { MAX_EVENT_ATTEMPTS } from "@/lib/events/dispatch";

/** Derived outbox state shown on /yonetim/olaylar. */
export type DomainEventState = "PROCESSED" | "PENDING" | "RETRYING" | "FAILED";

export const DOMAIN_EVENT_STATES: DomainEventState[] = ["PROCESSED", "PENDING", "RETRYING", "FAILED"];

export function domainEventState(event: { processedAt: Date | null; attempts: number; lastError: string | null }): DomainEventState {
  if (event.processedAt) return "PROCESSED";
  if (event.attempts >= MAX_EVENT_ATTEMPTS) return "FAILED";
  if (event.lastError) return "RETRYING";
  return "PENDING";
}

function stateWhere(state: string): Prisma.DomainEventWhereInput | null {
  switch (state) {
    case "PROCESSED":
      return { processedAt: { not: null } };
    case "PENDING":
      return { processedAt: null, lastError: null, attempts: { lt: MAX_EVENT_ATTEMPTS } };
    case "RETRYING":
      return { processedAt: null, lastError: { not: null }, attempts: { lt: MAX_EVENT_ATTEMPTS } };
    case "FAILED":
      return { processedAt: null, attempts: { gte: MAX_EVENT_ATTEMPTS } };
    default:
      return null;
  }
}

export interface DomainEventFilters {
  page: number;
  perPage: number;
  type?: string;
  state?: string;
  aggregate?: string;
  subscriber?: string;
}

function buildWhere(filters: DomainEventFilters): Prisma.DomainEventWhereInput {
  const and: Prisma.DomainEventWhereInput[] = [];
  if (filters.type && isEventType(filters.type)) and.push({ type: filters.type });
  const state = filters.state ? stateWhere(filters.state) : null;
  if (state) and.push(state);
  const aggregate = filters.aggregate?.trim();
  if (aggregate) and.push({ aggregateId: { contains: aggregate, mode: "insensitive" } });
  if (filters.subscriber) and.push({ deliveries: { some: { subscriber: filters.subscriber, status: "FAILED" } } });
  return and.length ? { AND: and } : {};
}

/** Admin list; the payload is not selected (it may hold encrypted secrets). */
export async function getDomainEvents(filters: DomainEventFilters) {
  const where = buildWhere(filters);
  const [rows, total] = await Promise.all([
    db.domainEvent.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip: (filters.page - 1) * filters.perPage,
      take: filters.perPage,
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
        deliveries: { select: { subscriber: true, status: true } },
      },
    }),
    db.domainEvent.count({ where }),
  ]);
  return { rows, total, page: filters.page, perPage: filters.perPage, totalPages: Math.max(1, Math.ceil(total / filters.perPage)) };
}

export async function getDomainEventStats(now = new Date()) {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [last24h, unprocessed, failed, failedDeliveries] = await Promise.all([
    db.domainEvent.count({ where: { occurredAt: { gte: since } } }),
    db.domainEvent.count({ where: { processedAt: null, attempts: { lt: MAX_EVENT_ATTEMPTS } } }),
    db.domainEvent.count({ where: { processedAt: null, attempts: { gte: MAX_EVENT_ATTEMPTS } } }),
    db.eventDelivery.count({ where: { status: "FAILED" } }),
  ]);
  return { last24h, unprocessed, failed, failedDeliveries };
}

export const REDACTED = "•••••• (gizli)";

/** Detail view: payload with the catalogue's sensitive keys masked. */
export async function getDomainEventById(id: string) {
  const event = await db.domainEvent.findUnique({
    where: { id },
    include: { deliveries: { orderBy: { createdAt: "asc" } } },
  });
  if (!event) return null;

  const payload = { ...((event.payload ?? {}) as Record<string, unknown>) };
  if (isEventType(event.type)) {
    for (const key of getEventDefinition(event.type).sensitive ?? []) {
      if (payload[key]) payload[key] = REDACTED;
    }
  }
  const actor = event.actorId
    ? await db.user.findUnique({ where: { id: event.actorId }, select: { id: true, name: true, surname: true, email: true, role: true } })
    : null;
  return { ...event, payload, actor };
}
