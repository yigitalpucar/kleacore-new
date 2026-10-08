import type { EventPayload, EventType } from "../catalog";

/** A stored event as subscribers see it: payload validated, secrets decrypted. */
interface EventEnvelope<T extends EventType> {
  id: string;
  type: T;
  payload: EventPayload<T>;
  aggregateType: string;
  aggregateId: string;
  actorId: string | null;
  occurredAt: Date;
}

/** Discriminated union over the catalogue (narrow with `isEvent` or `event.type`). */
export type DispatchedEvent<T extends EventType = EventType> = { [K in T]: EventEnvelope<K> }[T];

/** `skipped` marks the delivery SKIPPED (nothing to do); anything else is stored as the result. */
export type SubscriberOutcome = ({ skipped?: string } & Record<string, unknown>) | void;

export interface EventSubscriber {
  /** Stable id stored in EventDelivery.subscriber; never rename. */
  name: string;
  label: string;
  handles(type: EventType): boolean;
  /**
   * Must be idempotent per event (use the event id or a business dedupe key):
   * a crash after the side effect but before the delivery row is updated runs
   * it again. Throw to have the delivery retried.
   */
  handle(event: DispatchedEvent): Promise<SubscriberOutcome>;
}

/** Narrowing helper for subscribers that switch on the type. */
export function isEvent<T extends EventType>(event: DispatchedEvent, type: T): event is Extract<DispatchedEvent, { type: T }> {
  return event.type === type;
}
