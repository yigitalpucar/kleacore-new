import { beforeEach, describe, expect, it, vi } from "vitest";

const { handler, recordHeartbeat } = vi.hoisted(() => ({ handler: vi.fn(), recordHeartbeat: vi.fn() }));

vi.mock("./heartbeat", () => ({ recordHeartbeat }));
vi.mock("./boss", () => ({ getBoss: vi.fn() }));
vi.mock("./definitions", async () => {
  const { z } = await import("zod");
  const { createRegistry, defineJob } = await import("./registry");
  return {
    jobRegistry: createRegistry([
      defineJob({ name: "test.job", label: "t", schema: z.object({ n: z.number() }), handler }),
    ]),
  };
});

import { drainJobs, jobContext } from "./worker";

type FakeJob = { id: string; name: string; data: unknown; retryCount: number; retryLimit: number };

function fakeBoss(jobs: FakeJob[]) {
  const queue = [...jobs];
  return {
    supervise: vi.fn().mockResolvedValue(undefined),
    fetch: vi.fn(async () => (queue.length ? [queue.shift()!] : [])),
    complete: vi.fn().mockResolvedValue({}),
    fail: vi.fn().mockResolvedValue({}),
  };
}

describe("drainJobs", () => {
  beforeEach(() => {
    handler.mockReset();
    recordHeartbeat.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("completes successful jobs and fails throwing ones so pg-boss can retry them", async () => {
    const boss = fakeBoss([
      { id: "j1", name: "test.job", data: { n: 1 }, retryCount: 0, retryLimit: 2 },
      { id: "j2", name: "test.job", data: { n: 2 }, retryCount: 1, retryLimit: 2 },
    ]);
    handler.mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new Error("REMOTE_DOWN"));

    const result = await drainJobs({ boss: boss as never });

    expect(result).toMatchObject({ completed: 1, failed: 1, truncated: false });
    expect(boss.complete).toHaveBeenCalledWith("test.job", { id: "j1", retryCount: 0 }, { ok: true });
    expect(boss.fail).toHaveBeenCalledWith(
      "test.job",
      { id: "j2", retryCount: 1 },
      expect.objectContaining({ message: "REMOTE_DOWN" })
    );
    expect(handler.mock.calls[1][1]).toMatchObject({ retryCount: 1, retryLimit: 2, isFinalAttempt: false });
    expect(boss.supervise).toHaveBeenCalled();
    expect(recordHeartbeat).toHaveBeenCalledWith("drain", "drain", expect.any(Object));
  });

  it("fails a job whose payload no longer matches the schema without calling the handler", async () => {
    const boss = fakeBoss([{ id: "j1", name: "test.job", data: { n: "x" }, retryCount: 0, retryLimit: 0 }]);

    await drainJobs({ boss: boss as never });

    expect(handler).not.toHaveBeenCalled();
    expect(boss.fail).toHaveBeenCalled();
  });

  it("stops fetching once the time budget is used", async () => {
    const boss = fakeBoss([{ id: "j1", name: "test.job", data: { n: 1 }, retryCount: 0, retryLimit: 0 }]);

    const result = await drainJobs({ boss: boss as never, budgetMs: 0 });

    expect(boss.fetch).not.toHaveBeenCalled();
    expect(result.truncated).toBe(true);
  });
});

describe("jobContext", () => {
  it("marks the attempt that exhausts retryLimit as final", () => {
    expect(jobContext({ id: "j", name: "n", data: {}, retryCount: 4, retryLimit: 4 }).isFinalAttempt).toBe(true);
    expect(jobContext({ id: "j", name: "n", data: {}, retryCount: 3, retryLimit: 4 }).isFinalAttempt).toBe(false);
  });
});
