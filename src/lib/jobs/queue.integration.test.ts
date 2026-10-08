/**
 * Integration tests against a real Postgres (pg-boss + advisory locks).
 * Skipped unless RUN_DB_TESTS=1; uses DATABASE_URL from .env — point it at a
 * local/dev database, never production:
 *
 *   pnpm test:db
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { handler } = vi.hoisted(() => ({ handler: vi.fn() }));

// The real provisioning handler needs orders/services; the queue mechanics
// under test only need a handler we control.
vi.mock("@/lib/provisioning/retry-queue", () => ({ runQueuedProvisioningJob: handler }));

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { runCronWithLock } from "@/lib/cron/run-log";
import { listProblemJobs, retryQueueJob, findQueueJob } from "./admin";
import { getBoss, stopBoss } from "./boss";
import { PROVISIONING_RUN_JOB } from "./definitions";
import { enqueue } from "./enqueue";
import { drainJobs } from "./worker";

const enabled = process.env.RUN_DB_TESTS === "1";

describe.runIf(enabled)("job queue (integration, real Postgres)", () => {
  const created: string[] = [];

  beforeAll(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await getBoss();
  });

  afterAll(async () => {
    const boss = await getBoss();
    if (created.length) await boss.deleteJob(PROVISIONING_RUN_JOB, created).catch(() => {});
    await db.cronRun.deleteMany({ where: { job: { startsWith: "itest-" } } });
    await stopBoss({ graceful: false });
  });

  it("enqueue is idempotent per singletonKey", async () => {
    const key = `itest-${randomUUID()}`;
    const first = await enqueue(PROVISIONING_RUN_JOB, { provisioningJobId: key }, { singletonKey: key, startAfter: 3600 });
    const second = await enqueue(PROVISIONING_RUN_JOB, { provisioningJobId: key }, { singletonKey: key });
    if (first.id) created.push(first.id);

    expect(first.deduplicated).toBe(false);
    expect(second).toEqual({ id: null, deduplicated: true });
    const boss = await getBoss();
    expect(await boss.findJobs(PROVISIONING_RUN_JOB, { key })).toHaveLength(1);
  });

  it("a job enqueued inside a rolled-back Prisma transaction never exists", async () => {
    const key = `itest-${randomUUID()}`;
    await expect(
      db.$transaction(async (tx) => {
        await enqueue(PROVISIONING_RUN_JOB, { provisioningJobId: key }, { singletonKey: key, tx });
        throw new Error("rollback");
      })
    ).rejects.toThrow("rollback");

    const boss = await getBoss();
    expect(await boss.findJobs(PROVISIONING_RUN_JOB, { key })).toHaveLength(0);
  });

  it("a failed job shows up for the admin and 'yeniden dene' completes it", async () => {
    const key = `itest-${randomUUID()}`;
    const { id } = await enqueue(PROVISIONING_RUN_JOB, { provisioningJobId: key }, { singletonKey: key, retryLimit: 0 });
    expect(id).toBeTruthy();
    created.push(id!);

    handler.mockRejectedValueOnce(new Error("WHM_HTTP_500"));
    await drainJobs({ names: [PROVISIONING_RUN_JOB], budgetMs: 10_000 });

    const problems = await listProblemJobs(500);
    const failed = problems.find((job) => job.id === id);
    expect(failed).toMatchObject({ state: "failed", error: "WHM_HTTP_500", name: PROVISIONING_RUN_JOB });

    handler.mockResolvedValueOnce({ ok: true });
    await expect(retryQueueJob(PROVISIONING_RUN_JOB, id!)).resolves.toEqual({ ok: true });
    await drainJobs({ names: [PROVISIONING_RUN_JOB], budgetMs: 10_000 });

    expect((await findQueueJob(PROVISIONING_RUN_JOB, id!))?.state).toBe("completed");
    expect(handler).toHaveBeenLastCalledWith(key, expect.objectContaining({ isFinalAttempt: true }));
  });

  it("the same cron job can't run twice concurrently: the second call returns locked", async () => {
    const job = `itest-${randomUUID()}`;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let started!: () => void;
    const running = new Promise<void>((resolve) => (started = resolve));

    const first = runCronWithLock(job, async () => {
      started();
      await gate;
      return { processed: 1 };
    });
    await running;

    const secondJob = vi.fn();
    const second = await runCronWithLock(job, secondJob);
    release();

    expect(second).toEqual({ status: "locked" });
    expect(secondJob).not.toHaveBeenCalled();
    await expect(first).resolves.toMatchObject({ status: "succeeded" });

    const runs = await db.cronRun.findMany({ where: { job }, orderBy: { startedAt: "asc" } });
    expect(runs.map((r) => r.status).sort()).toEqual(["LOCKED", "SUCCEEDED"]);

    // Lock released: an idempotent re-run succeeds.
    await expect(runCronWithLock(job, async () => ({ processed: 0 }))).resolves.toMatchObject({ status: "succeeded" });
  });
});
