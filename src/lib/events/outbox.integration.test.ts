/**
 * Outbox acceptance against a real Postgres + pg-boss (roadmap 3.1):
 * - an event written in a transaction that rolls back leaves neither the
 *   DomainEvent row nor its events.dispatch job;
 * - a committed event is dispatched by the queue exactly once per subscriber,
 *   and a second dispatch of the same event sends nothing again.
 *
 * Skipped unless RUN_DB_TESTS=1; uses DATABASE_URL from .env — point it at a
 * local/dev database, never production:
 *
 *   RUN_DB_TESTS=1 pnpm vitest run src/lib/events/outbox.integration.test.ts
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { getBoss, stopBoss } from "@/lib/jobs/boss";
import { EVENTS_DISPATCH_JOB } from "@/lib/jobs/definitions";
import { drainJobs } from "@/lib/jobs/worker";
import { dispatchDomainEvent } from "./dispatch";
import { emitEvent } from "./emit";

const enabled = process.env.RUN_DB_TESTS === "1";

describe.runIf(enabled)("transactional outbox (integration, real Postgres)", () => {
  const eventIds: string[] = [];
  let userId = "";

  beforeAll(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await getBoss();
    const user = await db.user.findFirstOrThrow({ where: { role: "CUSTOMER" }, select: { id: true } });
    userId = user.id;
  });

  afterAll(async () => {
    await db.notificationLog.deleteMany({ where: { dedupeKey: { in: eventIds.map((id) => `password.changed:${id}`) } } });
    await db.domainEvent.deleteMany({ where: { id: { in: eventIds } } });
    await stopBoss({ graceful: false });
  });

  it("rollback → no event and no dispatch job", async () => {
    let emittedId = "";
    await expect(
      db.$transaction(async (tx) => {
        const emitted = await emitEvent(tx, "user.verified", { userId });
        emittedId = emitted.id;
        expect(emitted.queued).toBe(true);
        throw new Error("business change failed");
      })
    ).rejects.toThrow("business change failed");

    expect(emittedId).not.toBe("");
    expect(await db.domainEvent.findUnique({ where: { id: emittedId } })).toBeNull();
    const boss = await getBoss();
    expect(await boss.findJobs(EVENTS_DISPATCH_JOB, { key: emittedId })).toHaveLength(0);
  });

  it("commit → event + job; the queue delivers once and a re-dispatch sends nothing twice", async () => {
    const emitted = await db.$transaction((tx) =>
      emitEvent(tx, "user.password_changed", { userId, changedAt: new Date(), method: "profile" }, { actorId: userId })
    );
    eventIds.push(emitted.id);

    const boss = await getBoss();
    expect(await boss.findJobs(EVENTS_DISPATCH_JOB, { key: emitted.id })).toHaveLength(1);

    await drainJobs({ names: [EVENTS_DISPATCH_JOB], budgetMs: 10_000 });

    const event = await db.domainEvent.findUniqueOrThrow({ where: { id: emitted.id }, include: { deliveries: true } });
    expect(event.processedAt).not.toBeNull();
    expect(event.deliveries.map((d) => [d.subscriber, d.status])).toEqual([["notifications", "DELIVERED"]]);
    const logs = await db.notificationLog.count({ where: { dedupeKey: `password.changed:${emitted.id}` } });
    expect(logs).toBeGreaterThanOrEqual(1);

    // Admin "yeniden dağıt" of a processed event / duplicate job: nothing is sent again.
    await db.domainEvent.update({ where: { id: emitted.id }, data: { processedAt: null } });
    await dispatchDomainEvent(emitted.id);
    expect(await db.notificationLog.count({ where: { dedupeKey: `password.changed:${emitted.id}` } })).toBe(logs);
  });
});
