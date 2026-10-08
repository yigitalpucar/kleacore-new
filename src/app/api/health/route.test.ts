import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw, findFirst } = vi.hoisted(() => ({ queryRaw: vi.fn(), findFirst: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: { $queryRaw: queryRaw, jobWorkerHeartbeat: { findFirst } } }));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    queryRaw.mockReset();
    findFirst.mockReset();
    findFirst.mockResolvedValue({ lastSeenAt: new Date() });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 200 when the database answers", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks.database).toBe("ok");
    expect(body.checks.jobs).toBe("ok");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("stays 200 but reports degraded when the job worker is idle", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    findFirst.mockResolvedValue({ lastSeenAt: new Date(Date.now() - 6 * 60 * 1000) });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("degraded");
    expect(body.checks).toEqual({ database: "ok", jobs: "degraded" });
  });

  it("reports degraded when no worker or drain has ever run", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    findFirst.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(200);
    expect((await res.json()).checks.jobs).toBe("degraded");
  });

  it("returns 503 without leaking the error when the database is down", async () => {
    queryRaw.mockRejectedValue(
      new Error("connect ECONNREFUSED postgresql://user:hunter2@db:5432/kleacore")
    );

    const res = await GET();
    const text = await res.text();

    expect(res.status).toBe(503);
    expect(JSON.parse(text).checks.database).toBe("error");
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("ECONNREFUSED");
  });
});
