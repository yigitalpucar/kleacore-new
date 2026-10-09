import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFraudConfig: vi.fn(),
  lookup: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/fraud/settings", () => ({ getFraudConfig: mocks.getFraudConfig }));
vi.mock("@/lib/fraud/ip-country", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/fraud/ip-country")>();
  return {
    ...actual,
    resolveIpCountry: (input: Parameters<typeof actual.resolveIpCountry>[0]) => actual.resolveIpCountry(input, mocks.lookup),
  };
});

import { clientIpFromHeaders, requestMetaFromHeaders } from "./request-meta";

function list(values: Record<string, string>) {
  return new Headers(values);
}

describe("clientIpFromHeaders", () => {
  it("takes the first X-Forwarded-For hop, then X-Real-IP", () => {
    expect(clientIpFromHeaders(list({ "x-forwarded-for": "203.0.113.5, 10.0.0.1", "x-real-ip": "10.0.0.9" }))).toBe("203.0.113.5");
    expect(clientIpFromHeaders(list({ "x-real-ip": " 198.51.100.7 " }))).toBe("198.51.100.7");
    expect(clientIpFromHeaders(list({}))).toBeNull();
    expect(clientIpFromHeaders(null)).toBeNull();
  });

  it("reduces IPv4-mapped IPv6 to IPv4", () => {
    expect(clientIpFromHeaders(list({ "x-forwarded-for": "::ffff:203.0.113.5" }))).toBe("203.0.113.5");
  });
});

describe("requestMetaFromHeaders country", () => {
  beforeEach(() => {
    mocks.getFraudConfig.mockReset().mockResolvedValue({ trustCfHeader: true });
    mocks.lookup.mockReset().mockResolvedValue(null);
  });

  it("uses a trusted CF-IPCountry header", async () => {
    const meta = await requestMetaFromHeaders(list({ "x-forwarded-for": "203.0.113.5", "cf-ipcountry": "de", "user-agent": "UA" }));
    expect(meta).toEqual({ ip: "203.0.113.5", userAgent: "UA", country: "DE", countrySource: "cf-header" });
  });

  it("ignores the header when the fraud setting does not trust it, falling back to the IP DB", async () => {
    mocks.getFraudConfig.mockResolvedValue({ trustCfHeader: false });
    mocks.lookup.mockResolvedValue("NL");
    const meta = await requestMetaFromHeaders(list({ "x-forwarded-for": "203.0.113.5", "cf-ipcountry": "DE" }));
    expect(meta).toMatchObject({ country: "NL", countrySource: "db" });
  });

  it("ignores a home-country header the IP DB contradicts (forged on the non-proxied root domain)", async () => {
    mocks.lookup.mockResolvedValue("RU");
    const meta = await requestMetaFromHeaders(list({ "x-forwarded-for": "203.0.113.5", "cf-ipcountry": "TR" }));
    expect(meta).toMatchObject({ country: "RU", countrySource: "db" });
  });

  it("has no country without a header or DB match", async () => {
    const meta = await requestMetaFromHeaders(list({ "x-forwarded-for": "203.0.113.5" }));
    expect(meta).toMatchObject({ country: null, countrySource: null });
    expect(mocks.getFraudConfig).not.toHaveBeenCalled();
  });
});
