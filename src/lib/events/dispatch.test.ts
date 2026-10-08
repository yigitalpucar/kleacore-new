import { beforeEach, describe, expect, it, vi } from "vitest";

type Delivery = { eventId: string; subscriber: string; status: string; attempts: number; lastError: string | null };
type EventRow = {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  actorId: string | null;
  occurredAt: Date;
  processedAt: Date | null;
  attempts: number;
  lastError: string | null;
};

const store = vi.hoisted(() => ({
  events: new Map<string, EventRow>(),
  deliveries: [] as Delivery[],
}));

vi.mock("@/lib/db", () => {
  const find = (eventId: string, subscriber: string) =>
    store.deliveries.find((d) => d.eventId === eventId && d.subscriber === subscriber);
  const apply = (row: Record<string, unknown>, data: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "object" && "increment" in (value as object)) {
        row[key] = (row[key] as number) + (value as { increment: number }).increment;
      } else {
        row[key] = value;
      }
    }
  };
  return {
    db: {
      domainEvent: {
        findMany: async () =>
          [...store.events.values()].filter((event) => !event.processedAt).map((event) => ({ id: event.id })),
        findUnique: async ({ where }: { where: { id: string } }) => {
          const event = store.events.get(where.id);
          if (!event) return null;
          return {
            ...event,
            deliveries: store.deliveries
              .filter((d) => d.eventId === event.id)
              .map((d) => ({ subscriber: d.subscriber, status: d.status })),
          };
        },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const event = store.events.get(where.id)!;
          apply(event as unknown as Record<string, unknown>, data);
          return event;
        },
      },
      eventDelivery: {
        upsert: async ({ where }: { where: { eventId_subscriber: { eventId: string; subscriber: string } } }) => {
          const { eventId, subscriber } = where.eventId_subscriber;
          let row = find(eventId, subscriber);
          if (!row) {
            row = { eventId, subscriber, status: "PENDING", attempts: 0, lastError: null };
            store.deliveries.push(row);
          }
          return row;
        },
        update: async ({
          where,
          data,
        }: {
          where: { eventId_subscriber: { eventId: string; subscriber: string } };
          data: Record<string, unknown>;
        }) => {
          const row = find(where.eventId_subscriber.eventId, where.eventId_subscriber.subscriber)!;
          apply(row as unknown as Record<string, unknown>, data);
          return row;
        },
      },
    },
  };
});

const enqueue = vi.hoisted(() => vi.fn());
vi.mock("@/lib/jobs/enqueue", () => ({ enqueue }));
vi.mock("./subscribers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./subscribers")>()),
  eventSubscribers: [],
}));

import { encryptSecret } from "@/lib/secrets/crypto";
import { dispatchDomainEvent, EventDispatchError, sweepPendingEvents } from "./dispatch";
import type { EventSubscriber } from "./subscribers";

function seedEvent(overrides: Partial<EventRow> = {}) {
  const event: EventRow = {
    id: "evt-1",
    type: "invoice.paid",
    aggregateType: "Invoice",
    aggregateId: "inv-1",
    payload: {
      invoiceId: "inv-1",
      invoiceNumber: "F-1",
      customerId: "cus-1",
      amount: "100",
      paidAt: "2026-10-08T10:00:00.000Z",
      context: "invoice",
    },
    actorId: "cus-1",
    occurredAt: new Date(),
    processedAt: null,
    attempts: 0,
    lastError: null,
    ...overrides,
  };
  store.events.set(event.id, event);
  return event;
}

function subscriber(name: string, handle: EventSubscriber["handle"]): EventSubscriber & { handle: ReturnType<typeof vi.fn> } {
  return { name, label: name, handles: () => true, handle: vi.fn(handle) } as never;
}

describe("dispatchDomainEvent", () => {
  beforeEach(() => {
    store.events.clear();
    store.deliveries.length = 0;
    process.env.ENCRYPTION_KEY ??= "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("delivers to every subscriber once and marks the event processed", async () => {
    seedEvent();
    const a = subscriber("a", async () => ({ ok: true }));
    const b = subscriber("b", async () => ({ skipped: "NOTHING_TO_DO" }));

    const result = await dispatchDomainEvent("evt-1", { subscribers: [a, b] });

    expect(result).toMatchObject({ status: "processed", delivered: ["a"], skipped: ["b"] });
    expect(store.events.get("evt-1")!.processedAt).toBeInstanceOf(Date);
    expect(store.deliveries.map((d) => [d.subscriber, d.status])).toEqual([
      ["a", "DELIVERED"],
      ["b", "SKIPPED"],
    ]);

    // A duplicate job for a processed event does nothing.
    expect(await dispatchDomainEvent("evt-1", { subscribers: [a, b] })).toMatchObject({ status: "already_processed" });
    expect(a.handle).toHaveBeenCalledTimes(1);
  });

  it("retries only the failed subscriber after a partial failure (no double send)", async () => {
    seedEvent();
    const notify = subscriber("notifications", async () => ({ sent: true }));
    let webhookCalls = 0;
    const webhook = subscriber("webhooks", async () => {
      webhookCalls += 1;
      if (webhookCalls === 1) throw new Error("WEBHOOK_HTTP_502");
      return { status: 200 };
    });
    const activity = subscriber("activity-log", async () => ({ logged: true }));

    // First attempt: webhooks fails, the others are delivered; the job throws to be retried.
    await expect(dispatchDomainEvent("evt-1", { subscribers: [notify, webhook, activity] })).rejects.toBeInstanceOf(
      EventDispatchError
    );
    const afterFirst = store.events.get("evt-1")!;
    expect(afterFirst.processedAt).toBeNull();
    expect(afterFirst.attempts).toBe(1);
    expect(afterFirst.lastError).toMatch(/webhooks: WEBHOOK_HTTP_502/);
    expect(store.deliveries.find((d) => d.subscriber === "webhooks")).toMatchObject({ status: "FAILED", attempts: 1 });

    // Retry: only webhooks runs again.
    const retry = await dispatchDomainEvent("evt-1", { subscribers: [notify, webhook, activity] });
    expect(retry).toMatchObject({ status: "processed", delivered: ["webhooks"], alreadyDone: ["notifications", "activity-log"] });
    expect(notify.handle).toHaveBeenCalledTimes(1);
    expect(activity.handle).toHaveBeenCalledTimes(1);
    expect(webhook.handle).toHaveBeenCalledTimes(2);
    expect(store.deliveries.find((d) => d.subscriber === "webhooks")).toMatchObject({ status: "DELIVERED", attempts: 2 });
    expect(store.events.get("evt-1")!.processedAt).toBeInstanceOf(Date);
  });

  it("only offers an event to subscribers of its type", async () => {
    seedEvent();
    const other = { ...subscriber("other", async () => ({})), handles: () => false };
    const result = await dispatchDomainEvent("evt-1", { subscribers: [other] });
    expect(result.delivered).toEqual([]);
    expect(other.handle).not.toHaveBeenCalled();
  });

  it("decrypts sensitive payload fields for subscribers", async () => {
    seedEvent({
      type: "service.activated",
      aggregateType: "Service",
      aggregateId: "svc-1",
      payload: {
        serviceId: "svc-1",
        customerId: "cus-1",
        serviceLabel: "VDS",
        kind: "server",
        password: encryptSecret("S3cret!"),
      },
    });
    const seen: unknown[] = [];
    const spy = subscriber("spy", async (event) => {
      seen.push(event.payload);
      return {};
    });

    await dispatchDomainEvent("evt-1", { subscribers: [spy] });
    expect(seen[0]).toMatchObject({ password: "S3cret!" });
  });

  it("reports a missing event without throwing", async () => {
    expect(await dispatchDomainEvent("nope", { subscribers: [] })).toMatchObject({ status: "not_found" });
  });
});

describe("sweepPendingEvents (jobs-drain)", () => {
  beforeEach(() => {
    store.events.clear();
    store.deliveries.length = 0;
    enqueue.mockReset();
  });

  it("queues events whose dispatch job never existed", async () => {
    seedEvent();
    enqueue.mockResolvedValue({ id: "job-1", deduplicated: false });
    expect(await sweepPendingEvents()).toMatchObject({ checked: 1, queued: 1, inline: 0 });
    expect(enqueue).toHaveBeenCalledWith("events.dispatch", { eventId: "evt-1" }, { singletonKey: "evt-1" });
  });

  it("dispatches inline when the queue is unreachable", async () => {
    seedEvent();
    enqueue.mockRejectedValue(new Error("pg-boss down"));
    expect(await sweepPendingEvents()).toMatchObject({ checked: 1, queued: 0, inline: 1 });
    expect(store.events.get("evt-1")!.processedAt).toBeInstanceOf(Date);
  });
});
