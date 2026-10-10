import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { money } from "@/lib/money";

const mocks = vi.hoisted(() => ({ rateLimit: vi.fn(), single: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: {
    domain: { findMany: async () => [] },
    domainTld: {
      findMany: async () => [
        { ext: ".com", registerPrice: money(149), renewPrice: money(199) },
        { ext: ".net", registerPrice: money(179), renewPrice: money(229) },
        { ext: ".com.tr", registerPrice: money(99), renewPrice: money(149) },
      ],
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.rateLimit, normalizeRateLimitKey: (v: string) => v }));
vi.mock("@/lib/request-meta", () => ({ getRequestMeta: async () => ({ ip: "1.2.3.4" }) }));
vi.mock("@/lib/integrations/registrar", () => ({
  getRegistrarProvider: async () => ({ checkDomainAvailability: mocks.single }),
}));

import { GET } from "./route";

const get = (query: string) => GET(new NextRequest(`http://localhost/api/domain/search?${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockResolvedValue({ allowed: true, remaining: 5 });
  mocks.single.mockImplementation(async (domain: string) => ({ ok: true, data: { domain, available: domain.endsWith(".net") } }));
});

describe("GET /api/domain/search", () => {
  it("checks only sold TLDs, typed extension first, with DB prices", async () => {
    const response = await get("q=Marka.com.tr");
    const body = await response.json();
    expect(body.results.map((row: { domain: string }) => row.domain)).toEqual(["marka.com.tr", "marka.com", "marka.net"]);
    expect(body.results[2]).toMatchObject({ status: "available", price: 149 + 30, renewPrice: 229 });
    expect(mocks.rateLimit).toHaveBeenCalledWith(expect.objectContaining({ key: "domain-search:marka", limit: 30 }));
    expect(mocks.rateLimit).toHaveBeenCalledWith(expect.objectContaining({ key: "domain-search:ip:1.2.3.4", limit: 60 }));
  });

  it("ignores TLDs that are not sold", async () => {
    const body = await (await get("q=yeni&tlds=.net,.xyz")).json();
    expect(body.results.map((row: { ext: string }) => row.ext)).toEqual([".net"]);
  });

  it("answers 429 when rate limited and 400 for an invalid label", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 30 });
    expect((await get("q=yeni")).status).toBe(429);
    expect((await get("q=%C3%B6rnek")).status).toBe(400);
  });
});
