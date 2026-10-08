import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { decryptSecret, isEncryptedValue } from "@/lib/secrets/crypto";
import { getEventDefinition, isEventType, type EventType } from "./catalog";
import { eventSubscribers, subscribersFor, type DispatchedEvent, type EventSubscriber } from "./subscribers";

const log = createLogger("events.dispatch");

/**
 * Attempts after which the sweep stops picking an event up on its own
 * (= one full events.dispatch job with its retries). It then waits for
 * "yeniden dağıt" on /yonetim/olaylar.
 */
export const MAX_EVENT_ATTEMPTS = 6;
/** The sweep leaves fresh events to their own job for this long. */
const SWEEP_GRACE_MS = 60 * 1000;
/** And ignores events older than this (they need an admin decision). */
const SWEEP_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export class EventDispatchError extends Error {
  constructor(
    readonly eventId: string,
    readonly failures: Array<{ subscriber: string; error: string }>
  ) {
    super(`Event ${eventId}: ${failures.map((f) => `${f.subscriber}: ${f.error}`).join("; ")}`);
    this.name = "EventDispatchError";
  }
}

function revealPayload(type: EventType, payload: Record<string, unknown>) {
  const definition = getEventDefinition(type);
  const parsed = definition.schema.parse(payload) as Record<string, unknown>;
  for (const key of definition.sensitive ?? []) {
    const value = parsed[key];
    if (typeof value === "string" && isEncryptedValue(value)) parsed[key] = decryptSecret(value);
  }
  return parsed;
}

function errorMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1000);
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export interface DispatchResult {
  eventId: string;
  status: "processed" | "already_processed" | "not_found";
  delivered: string[];
  skipped: string[];
  alreadyDone: string[];
}

/**
 * Delivers one outbox event to its subscribers (the events.dispatch job).
 *
 * Per-subscriber idempotency: each subscriber has an EventDelivery row
 * (eventId + subscriber unique). DELIVERED/SKIPPED rows are never run again,
 * so a retry after a partial failure only re-runs the failed subscribers.
 * When any subscriber fails, the error is recorded and an EventDispatchError
 * is thrown (pg-boss retries with backoff); when all are done processedAt is set.
 */
export async function dispatchDomainEvent(
  eventId: string,
  options: { subscribers?: readonly EventSubscriber[] } = {}
): Promise<DispatchResult> {
  const result: DispatchResult = { eventId, status: "processed", delivered: [], skipped: [], alreadyDone: [] };
  const event = await db.domainEvent.findUnique({
    where: { id: eventId },
    include: { deliveries: { select: { subscriber: true, status: true } } },
  });
  if (!event) return { ...result, status: "not_found" };
  if (event.processedAt) return { ...result, status: "already_processed" };

  if (!isEventType(event.type)) {
    await db.domainEvent.update({
      where: { id: event.id },
      data: { attempts: { increment: 1 }, lastError: `UNKNOWN_EVENT_TYPE: ${event.type}` },
    });
    throw new EventDispatchError(event.id, [{ subscriber: "-", error: `UNKNOWN_EVENT_TYPE: ${event.type}` }]);
  }

  const dispatched: DispatchedEvent = {
    id: event.id,
    type: event.type,
    payload: revealPayload(event.type, (event.payload ?? {}) as Record<string, unknown>) as DispatchedEvent["payload"],
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    actorId: event.actorId,
    occurredAt: event.occurredAt,
  } as DispatchedEvent;

  const done = new Map(event.deliveries.map((delivery) => [delivery.subscriber, delivery.status]));
  const failures: Array<{ subscriber: string; error: string }> = [];

  for (const subscriber of subscribersFor(event.type, options.subscribers ?? eventSubscribers)) {
    const status = done.get(subscriber.name);
    if (status === "DELIVERED" || status === "SKIPPED") {
      result.alreadyDone.push(subscriber.name);
      continue;
    }

    await db.eventDelivery.upsert({
      where: { eventId_subscriber: { eventId: event.id, subscriber: subscriber.name } },
      create: { eventId: event.id, subscriber: subscriber.name },
      update: {},
    });

    try {
      const outcome = await subscriber.handle(dispatched);
      const skipped = outcome && typeof outcome.skipped === "string" ? outcome.skipped : null;
      await db.eventDelivery.update({
        where: { eventId_subscriber: { eventId: event.id, subscriber: subscriber.name } },
        data: {
          status: skipped ? "SKIPPED" : "DELIVERED",
          attempts: { increment: 1 },
          lastError: null,
          deliveredAt: new Date(),
          result: toJson(outcome ?? undefined),
        },
      });
      (skipped ? result.skipped : result.delivered).push(subscriber.name);
    } catch (error) {
      const message = errorMessage(error);
      failures.push({ subscriber: subscriber.name, error: message });
      await db.eventDelivery.update({
        where: { eventId_subscriber: { eventId: event.id, subscriber: subscriber.name } },
        data: { status: "FAILED", attempts: { increment: 1 }, lastError: message },
      });
      log.warn("event subscriber failed", { eventId: event.id, type: event.type, subscriber: subscriber.name, error: message });
    }
  }

  if (failures.length > 0) {
    await db.domainEvent.update({
      where: { id: event.id },
      data: {
        attempts: { increment: 1 },
        lastError: failures.map((f) => `${f.subscriber}: ${f.error}`).join("; ").slice(0, 2000),
      },
    });
    throw new EventDispatchError(event.id, failures);
  }

  await db.domainEvent.update({
    where: { id: event.id },
    data: { processedAt: new Date(), attempts: { increment: 1 }, lastError: null },
  });
  return result;
}

/** Enqueues events.dispatch for one event (exclusive per event id). */
export async function enqueueEventDispatch(eventId: string) {
  const { enqueue } = await import("@/lib/jobs/enqueue");
  const { EVENTS_DISPATCH_JOB } = await import("@/lib/jobs/definitions");
  return enqueue(EVENTS_DISPATCH_JOB, { eventId }, { singletonKey: eventId });
}

/**
 * Outbox sweep, run by the every-minute jobs-drain cron before it drains:
 * unprocessed events older than a minute (their dispatch job was never
 * created, e.g. the queue was down at commit) get a job. Events whose job is
 * still queued/retrying are deduplicated by the singletonKey. With the queue
 * unreachable the events are dispatched inline instead.
 */
export async function sweepPendingEvents(now = new Date(), limit = 100) {
  const events = await db.domainEvent.findMany({
    where: {
      processedAt: null,
      attempts: { lt: MAX_EVENT_ATTEMPTS },
      occurredAt: { lt: new Date(now.getTime() - SWEEP_GRACE_MS), gt: new Date(now.getTime() - SWEEP_LOOKBACK_MS) },
    },
    select: { id: true },
    orderBy: { occurredAt: "asc" },
    take: limit,
  });

  let queued = 0;
  let inline = 0;
  let failed = 0;
  let queueDown = false;

  for (const event of events) {
    if (!queueDown) {
      try {
        const result = await enqueueEventDispatch(event.id);
        if (!result.deduplicated) queued += 1;
        continue;
      } catch (error) {
        queueDown = true;
        log.error("job queue unavailable; dispatching events inline", { error });
      }
    }
    try {
      await dispatchDomainEvent(event.id);
      inline += 1;
    } catch {
      failed += 1;
    }
  }

  return { checked: events.length, queued, inline, failed };
}

/**
 * "Yeniden dağıt" (/yonetim/olaylar): re-opens an event for delivery.
 * Without `subscriber` only FAILED/PENDING deliveries run again; with one,
 * that subscriber runs again even if it was DELIVERED (its own dedupe keys
 * still stop duplicate notifications).
 */
export async function redeliverEvent(eventId: string, subscriber?: string) {
  const event = await db.domainEvent.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw new Error("EVENT_NOT_FOUND");

  await db.$transaction(async (tx) => {
    if (subscriber) {
      await tx.eventDelivery.updateMany({
        where: { eventId, subscriber },
        data: { status: "PENDING", lastError: null },
      });
    }
    await tx.domainEvent.update({ where: { id: eventId }, data: { processedAt: null, attempts: 0, lastError: null } });
  });

  try {
    const result = await enqueueEventDispatch(eventId);
    return { queued: true, deduplicated: result.deduplicated };
  } catch (error) {
    log.warn("redeliver: queue unavailable, dispatching inline", { eventId, error });
    await dispatchDomainEvent(eventId);
    return { queued: false, deduplicated: false };
  }
}
