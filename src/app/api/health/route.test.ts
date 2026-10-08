import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: { $queryRaw: queryRaw } }));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    queryRaw.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 200 when the database answers", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks.database).toBe("ok");
    expect(res.headers.get("cache-control")).toBe("no-store");
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
