import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runCronWithLock } = vi.hoisted(() => ({ runCronWithLock: vi.fn() }));

vi.mock("@/lib/cron/run-log", () => ({ runCronWithLock }));

import { NextRequest } from "next/server";
import { runCronJob } from "./handler";

function request(secret?: string, query = "") {
  return new NextRequest(`http://localhost/api/cron/daily-billing${query}`, {
    method: "POST",
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

function logged(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.map((call) => JSON.parse(call[0] as string));
}

describe("runCronJob", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
    runCronWithLock.mockReset();
    // Default: behave like an uncontended lock and run the job.
    runCronWithLock.mockImplementation(async (_job: string, fn: () => Promise<unknown>) => ({
      status: "succeeded",
      runId: "run-1",
      result: await fn(),
    }));
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("logs a structured error with the route when the job throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await runCronJob(request("test-secret"), "daily-billing", async () => {
      throw new Error("db down");
    });

    expect(res.status).toBe(500);
    expect(logged(spy)[0]).toMatchObject({
      level: "error",
      scope: "cron",
      path: "/api/cron/daily-billing",
      job: "daily-billing",
      error: { message: "db down" },
    });
  });

  it("logs rejected requests without the secret", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await runCronJob(request("wrong"), "daily-billing", async () => "never");

    expect(res.status).toBe(401);
    expect(runCronWithLock).not.toHaveBeenCalled();
    const [entry] = logged(spy);
    expect(entry).toMatchObject({ scope: "cron", cronSecretConfigured: true });
    expect(JSON.stringify(entry)).not.toContain("test-secret");
  });

  it("logs completion and returns the job result with the run id", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await runCronJob(request("test-secret"), "daily-billing", async () => ({ processed: 2 }));

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ processed: 2, status: "succeeded", job: "daily-billing", runId: "run-1" });
    expect(logged(spy)[0]).toMatchObject({ level: "info", message: "cron job finished" });
  });

  it("answers 200 locked without running when another run holds the lock", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    runCronWithLock.mockResolvedValue({ status: "locked" });
    const job = vi.fn();

    const res = await runCronJob(request("test-secret"), "daily-billing", job);

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ status: "locked", job: "daily-billing" });
    expect(job).not.toHaveBeenCalled();
  });

  it("passes ?force=1 through to bypass the once-per-day guard", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await runCronJob(request("test-secret", "?force=1"), "ssl-expiry", async () => ({}), { oncePerDay: true });

    expect(runCronWithLock).toHaveBeenCalledWith("ssl-expiry", expect.any(Function), { oncePerDay: true, force: true });
  });
});
