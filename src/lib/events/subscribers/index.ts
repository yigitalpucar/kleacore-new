import type { EventType } from "../catalog";
import { activityLogSubscriber } from "./activity-log";
import { adminAlertSubscriber } from "./admin-alert";
import { einvoiceSubscriber } from "./einvoice";
import { notificationsSubscriber } from "./notifications";
import type { EventSubscriber } from "./types";
import { webhooksSubscriber } from "./webhooks";

/**
 * Subscribers in delivery order. Notifications first (the customer-visible
 * effect), then the rest; each one has its own EventDelivery row, so a failing
 * subscriber is retried alone and never re-runs the ones that succeeded.
 */
export const eventSubscribers: readonly EventSubscriber[] = [
  notificationsSubscriber,
  einvoiceSubscriber,
  webhooksSubscriber,
  activityLogSubscriber,
  adminAlertSubscriber,
];

const names = new Set<string>();
for (const subscriber of eventSubscribers) {
  if (names.has(subscriber.name)) throw new Error(`Duplicate event subscriber "${subscriber.name}"`);
  names.add(subscriber.name);
}

export function subscribersFor(type: EventType, list: readonly EventSubscriber[] = eventSubscribers) {
  return list.filter((subscriber) => subscriber.handles(type));
}

export function getSubscriber(name: string) {
  return eventSubscribers.find((subscriber) => subscriber.name === name);
}

export type { DispatchedEvent, EventSubscriber, SubscriberOutcome } from "./types";
