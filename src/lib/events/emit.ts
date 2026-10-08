import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { encryptSecret, isEncryptedValue } from "@/lib/secrets/crypto";
import { getEventDefinition, type EventDefinition, type EventInput, type EventType } from "./catalog";

const log = createLogger("events.emit");

/** An interactive transaction (preferred) or the root client for code that has none. */
export type EventClient = Prisma.TransactionClient | typeof db;

export interface EmitEventOptions {
  /** User who caused the event (admin, customer); null for cron/system. */
  actorId?: string | null;
  occurredAt?: Date;
  /**
   * Enqueue the events.dispatch job with the event (default true). The job is
   * inserted through the same transaction, so it becomes visible exactly when
   * the business change commits. Without it (or when the queue is down) the
   * jobs-drain cron picks the event up within a minute.
   */
  dispatch?: boolean;
}

export interface EmittedEvent {
  id: string;
  type: EventType;
  /** False when the dispatch job could not be queued; the sweep delivers it. */
  queued: boolean;
}

function isTransaction(client: EventClient) {
  return !("$transaction" in client);
}

function protectPayload(definition: EventDefinition, payload: Record<string, unknown>) {
  if (!definition.sensitive?.length) return payload;
  const next = { ...payload };
  for (const key of definition.sensitive) {
    const value = next[key];
    if (typeof value === "string" && value && !isEncryptedValue(value)) next[key] = encryptSecret(value);
  }
  return next;
}

/** Validates a payload against the catalogue and returns the normalised (stored) form. */
export function normalizeEventPayload<T extends EventType>(type: T, payload: EventInput<T>) {
  const definition = getEventDefinition(type);
  const parsed = definition.schema.parse(payload) as Record<string, unknown>;
  const aggregateId = parsed[definition.aggregateKey];
  if (typeof aggregateId !== "string" || !aggregateId) {
    throw new Error(`Event ${type}: payload.${definition.aggregateKey} (aggregate id) is required`);
  }
  return { definition, parsed, aggregateId };
}

/**
 * Writes a domain event to the outbox (DomainEvent) through `tx`, i.e. in the
 * same transaction as the business change: a rollback leaves no event, a
 * commit always leaves one. Delivery to subscribers (notifications, webhooks,
 * activity log, e-invoice, admin alerts) happens after commit in the
 * events.dispatch job, each subscriber at most once (EventDelivery).
 *
 * Throws on an invalid payload (programming error) or when the insert fails;
 * callers that must never fail (payment fulfilment) wrap it in a savepoint.
 */
export async function emitEvent<T extends EventType>(
  tx: EventClient,
  type: T,
  payload: EventInput<T>,
  options: EmitEventOptions = {}
): Promise<EmittedEvent> {
  const { definition, parsed, aggregateId } = normalizeEventPayload(type, payload);

  const event = await tx.domainEvent.create({
    data: {
      type,
      aggregateType: definition.aggregate,
      aggregateId,
      payload: protectPayload(definition, parsed) as Prisma.InputJsonValue,
      actorId: options.actorId ?? null,
      ...(options.occurredAt ? { occurredAt: options.occurredAt } : {}),
    },
    select: { id: true },
  });

  const queued = options.dispatch === false ? false : await queueDispatch(tx, event.id);
  return { id: event.id, type, queued };
}

/**
 * Enqueues events.dispatch for one event. Inside a transaction the insert runs
 * in a savepoint, so a queue problem can never abort the caller's transaction.
 */
async function queueDispatch(tx: EventClient, eventId: string): Promise<boolean> {
  try {
    const { isJobQueueReady } = await import("@/lib/provisioning/queue");
    if (!(await isJobQueueReady())) return false;

    const { enqueue } = await import("@/lib/jobs/enqueue");
    const { EVENTS_DISPATCH_JOB } = await import("@/lib/jobs/definitions");

    if (!isTransaction(tx)) {
      await enqueue(EVENTS_DISPATCH_JOB, { eventId }, { singletonKey: eventId });
      return true;
    }

    const { withSavepoint } = await import("@/lib/payments/follow-ups");
    const result = await withSavepoint(tx as Prisma.TransactionClient, () =>
      enqueue(EVENTS_DISPATCH_JOB, { eventId }, { singletonKey: eventId, tx: tx as Prisma.TransactionClient })
    );
    if (!result.ok) throw result.error;
    return true;
  } catch (error) {
    log.warn("events.dispatch not queued; the jobs-drain sweep will deliver the event", { eventId, error });
    return false;
  }
}

/**
 * For call sites without a transaction whose business change already
 * committed (the old fire-and-forget notification spots): writes the event
 * with the root client and never throws — a lost event is logged, the
 * caller's success is not undone.
 */
export async function emitEventAfterCommit<T extends EventType>(
  type: T,
  payload: EventInput<T>,
  options: EmitEventOptions = {}
): Promise<EmittedEvent | null> {
  try {
    return await emitEvent(db, type, payload, options);
  } catch (error) {
    log.error("domain event could not be recorded", { type, error });
    return null;
  }
}
