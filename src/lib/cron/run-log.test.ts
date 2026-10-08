import { beforeEach, describe, expect, it, vi } from "vitest";

const { cronRun } = vi.hoisted(() => ({
  cronRun: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: { cronRun } }));

import { CronRunError, runCronWithLock, toSummary } from "./run-log";

const freeLock = async <T>(_key: string, fn: () => Promise<T>) => ({ acquired: true as const, value: await fn() });
const heldLock = async () => ({ acquired: false as const });

describe("runCronWithLock", () => {
  beforeEach(() => {
    Object.values(cronRun).forEach((fn) => fn.mockReset());
    cronRun.create.mockImplementation(async ({ data }) => ({ id: "run-1", ...data }));
    cronRun.update.mockResolvedValue({});
    cronRun.updateMany.mockResolvedValue({ count: 0 });
    cronRun.deleteMany.mockResolvedValue({ count: 0 });
  });

  it("records a successful run with its summary", async () => {
    const outcome = await runCronWithLock("daily-billing", async () => ({ processed: 3, ids: ["a"] }), { lock: freeLock });

    expect(outcome).toEqual({ status: "succeeded", runId: "run-1", result: { processed: 3, ids: ["a"] } });
    expect(cronRun.create).toHaveBeenCalledWith({ data: expect.objectContaining({ job: "daily-billing" }) });
    expect(cronRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({ status: "SUCCEEDED", summary: { processed: 3, ids: ["a"] } }),
    });
  });

  it("closes RUNNING rows left by a crashed run before starting (we hold the lock)", async () => {
    await runCronWithLock("daily-billing", async () => ({}), { lock: freeLock });

    expect(cronRun.updateMany).toHaveBeenCalledWith({
      where: { job: "daily-billing", status: "RUNNING" },
      data: expect.objectContaining({ status: "FAILED" }),
    });
  });

  it("does not run the job when the lock is held, and records LOCKED", async () => {
    const job = vi.fn();

    const outcome = await runCronWithLock("daily-billing", job, { lock: heldLock });

    expect(outcome).toEqual({ status: "locked" });
    expect(job).not.toHaveBeenCalled();
    expect(cronRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ job: "daily-billing", status: "LOCKED" }),
    });
  });

  it("records the error and rethrows when the job fails", async () => {
    const failing = runCronWithLock(
      "run-backups",
      async () => {
        throw new Error("disk full");
      },
      { lock: freeLock }
    );

    await expect(failing).rejects.toBeInstanceOf(CronRunError);
    expect(cronRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({ status: "FAILED", error: "disk full" }),
    });
  });

  it("skips a once-per-day job that already succeeded today, unless forced", async () => {
    cronRun.findFirst.mockResolvedValue({ id: "run-0", startedAt: new Date() });
    const job = vi.fn().mockResolvedValue({ processed: 1 });

    const skipped = await runCronWithLock("ssl-expiry", job, { lock: freeLock, oncePerDay: true });
    expect(skipped).toEqual({ status: "skipped", reason: "already-ran-today", previousRunId: "run-0" });
    expect(job).not.toHaveBeenCalled();

    const forced = await runCronWithLock("ssl-expiry", job, { lock: freeLock, oncePerDay: true, force: true });
    expect(forced.status).toBe("succeeded");
    expect(job).toHaveBeenCalledTimes(1);
  });

  it("runs a once-per-day job whose last success was on a previous day", async () => {
    cronRun.findFirst.mockResolvedValue({ id: "run-0", startedAt: new Date(Date.now() - 2 * 86_400_000) });
    const job = vi.fn().mockResolvedValue({});

    await expect(runCronWithLock("ssl-expiry", job, { lock: freeLock, oncePerDay: true })).resolves.toMatchObject({
      status: "succeeded",
    });
  });

  it("writes nothing to cron_runs when recording is off", async () => {
    await runCronWithLock("jobs-drain", async () => ({}), { lock: freeLock, record: false });
    await runCronWithLock("jobs-drain", async () => ({}), { lock: heldLock, record: false });

    expect(cronRun.create).not.toHaveBeenCalled();
    expect(cronRun.updateMany).not.toHaveBeenCalled();
  });
});

describe("toSummary", () => {
  it("trims long id lists", () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const summary = toSummary({ processed: 250, ids }) as { ids: string[]; idsTotal: number };
    expect(summary.ids).toHaveLength(200);
    expect(summary.idsTotal).toBe(250);
  });
});
