import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  search: vi.fn(async (_userId: string, _q: string) => [] as unknown[]),
  allow: vi.fn(async (_userId: string) => ({ allowed: true, remaining: 10 }) as { allowed: boolean; remaining: number; retryAfterSeconds?: number }),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/search/rate", () => ({ allowSearch: mocks.allow }));
vi.mock("@/lib/search/command-search", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/search/command-search")>()),
  searchCustomerRecords: mocks.search,
}));

import { GET } from "./route";

const req = (qs: string) => new NextRequest(`http://localhost/api/arama?${qs}`);

beforeEach(() => {
  mocks.auth.mockReset();
  mocks.search.mockClear();
  mocks.allow.mockClear();
});

describe("GET /api/arama (customer ⌘K)", () => {
  it("401 without a session, no search", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await GET(req("q=ornek"));
    expect(res.status).toBe(401);
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it("searches only the session user's records, ignoring any id in the URL", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "cus-1", role: "CUSTOMER" } });
    const res = await GET(req("q=ornek&customerId=cus-2&userId=cus-2"));
    expect(res.status).toBe(200);
    expect(mocks.search).toHaveBeenCalledWith("cus-1", "ornek");
  });

  it("short queries return no groups without hitting the rate limiter", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "cus-1" } });
    const res = await GET(req("q=a"));
    expect(await res.json()).toEqual({ groups: [] });
    expect(mocks.allow).not.toHaveBeenCalled();
  });

  it("429 when the per-user budget is spent", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "cus-1" } });
    mocks.allow.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 12 });
    const res = await GET(req("q=ornek"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
    expect(mocks.search).not.toHaveBeenCalled();
  });
});
