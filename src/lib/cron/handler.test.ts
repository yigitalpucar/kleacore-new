import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { runCronJob } from "./handler";

function request(secret?: string) {
  return new NextRequest("http://localhost/api/cron/daily-billing", {
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
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("logs a structured error with the route when the job throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await runCronJob(request("test-secret"), async () => {
      throw new Error("db down");
    });

    expect(res.status).toBe(500);
    expect(logged(spy)[0]).toMatchObject({
      level: "error",
      scope: "cron",
      path: "/api/cron/daily-billing",
      error: { message: "db down" },
    });
  });

  it("logs rejected requests without the secret", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await runCronJob(request("wrong"), async () => "never");

    expect(res.status).toBe(401);
    const [entry] = logged(spy);
    expect(entry).toMatchObject({ scope: "cron", cronSecretConfigured: true });
    expect(JSON.stringify(entry)).not.toContain("test-secret");
  });

  it("logs completion and returns the job result", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await runCronJob(request("test-secret"), async () => ({ processed: 2 }));

    expect(res.status).toBe(200);
    expect(logged(spy)[0]).toMatchObject({ level: "info", message: "cron job finished" });
  });
});
