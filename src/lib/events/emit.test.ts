import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isJobQueueReady: vi.fn(),
  enqueue: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { $transaction: vi.fn(), domainEvent: { create: vi.fn() } } }));
vi.mock("@/lib/provisioning/queue", () => ({ isJobQueueReady: mocks.isJobQueueReady }));
vi.mock("@/lib/jobs/enqueue", () => ({ enqueue: mocks.enqueue }));

import type { Prisma } from "@prisma/client";
import { decryptSecret, isEncryptedValue } from "@/lib/secrets/crypto";
import { listEventDefinitions } from "./catalog";
import { emitEvent } from "./emit";

function fakeTx() {
  const sql: string[] = [];
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "evt-1", ...data }));
  const tx = {
    domainEvent: { create },
    $executeRawUnsafe: vi.fn(async (statement: string) => sql.push(statement)),
  } as unknown as Prisma.TransactionClient;
  return { tx, create, sql };
}

const paid = {
  invoiceId: "inv-1",
  invoiceNumber: "F-2026-000001",
  customerId: "cus-1",
  amount: 120.5,
  paidAt: new Date("2026-10-08T10:00:00Z"),
  context: "order" as const,
};

describe("emitEvent", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.isJobQueueReady.mockResolvedValue(true);
    mocks.enqueue.mockResolvedValue({ id: "job-1", deduplicated: false });
    process.env.ENCRYPTION_KEY ??= "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("writes the normalised event through the caller's transaction and queues dispatch in a savepoint", async () => {
    const { tx, create, sql } = fakeTx();

    const result = await emitEvent(tx, "invoice.paid", paid, { actorId: "cus-1" });

    expect(result).toEqual({ id: "evt-1", type: "invoice.paid", queued: true });
    expect(create).toHaveBeenCalledWith({
      data: {
        type: "invoice.paid",
        aggregateType: "Invoice",
        aggregateId: "inv-1",
        payload: expect.objectContaining({ amount: "120.5", paidAt: "2026-10-08T10:00:00.000Z", context: "order" }),
        actorId: "cus-1",
      },
      select: { id: true },
    });
    // The job is inserted with the same transaction (visible only after commit), deduped per event.
    expect(mocks.enqueue).toHaveBeenCalledWith("events.dispatch", { eventId: "evt-1" }, { singletonKey: "evt-1", tx });
    expect(sql[0]).toMatch(/^SAVEPOINT/);
  });

  it("rejects an invalid payload before writing anything", async () => {
    const { tx, create } = fakeTx();
    await expect(emitEvent(tx, "invoice.paid", { ...paid, context: "bogus" } as never)).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("encrypts sensitive fields in the outbox payload", async () => {
    const { tx, create } = fakeTx();
    await emitEvent(tx, "service.activated", {
      serviceId: "svc-1",
      customerId: "cus-1",
      serviceLabel: "VDS Pro",
      kind: "server",
      password: "S3cret!",
    });
    const stored = create.mock.calls[0][0].data.payload as { password: string };
    expect(isEncryptedValue(stored.password)).toBe(true);
    expect(decryptSecret(stored.password)).toBe("S3cret!");
  });

  it("keeps the event and the caller's transaction when the queue is down", async () => {
    const { tx, create, sql } = fakeTx();
    mocks.enqueue.mockRejectedValue(new Error("pg-boss down"));

    const result = await emitEvent(tx, "invoice.paid", paid);

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.queued).toBe(false);
    expect(sql.some((statement) => statement.startsWith("ROLLBACK TO SAVEPOINT"))).toBe(true);
  });

  it("skips the enqueue entirely when the queue is not ready", async () => {
    const { tx } = fakeTx();
    mocks.isJobQueueReady.mockResolvedValue(false);
    expect(await emitEvent(tx, "invoice.paid", paid)).toMatchObject({ queued: false });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});

describe("event catalogue", () => {
  it("has ~30 typed events with unique types and an aggregate id key in every schema", () => {
    const definitions = listEventDefinitions();
    expect(definitions.length).toBeGreaterThanOrEqual(30);
    for (const definition of definitions) {
      expect(definition.type).toMatch(/^[a-z_]+\.[a-z_]+$/);
      const shape = (definition.schema as unknown as { shape: Record<string, unknown> }).shape;
      expect(Object.keys(shape)).toContain(definition.aggregateKey);
    }
  });
});
