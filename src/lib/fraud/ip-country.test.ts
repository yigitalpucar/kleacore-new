import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { isPrivateIp, normalizeCfCountry, parseIp, resolveIpCountry } from "./ip-country";

describe("parseIp", () => {
  it("parses IPv4, IPv6 (compressed) and IPv4-mapped IPv6", () => {
    expect(parseIp("78.160.0.1")).toEqual({ version: 4, value: BigInt(78 * 2 ** 24 + 160 * 2 ** 16 + 1) });
    expect(parseIp("::1")).toEqual({ version: 6, value: BigInt(1) });
    expect(parseIp("2a00:1d34::5")?.value).toBe(BigInt("0x2a001d34000000000000000000000005"));
    expect(parseIp("::ffff:78.160.0.1")).toEqual(parseIp("78.160.0.1"));
    expect(parseIp("[2001:db8::1]")?.version).toBe(6);
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "1.2.3", "256.1.1.1", "1.2.3.4.5", "abc", "1::2::3", "12345::", "1:2:3:4:5:6:7:8:9"]) {
      expect(parseIp(bad)).toBeNull();
    }
  });

  it("knows private and loopback ranges", () => {
    expect(isPrivateIp(parseIp("10.1.2.3")!)).toBe(true);
    expect(isPrivateIp(parseIp("192.168.1.1")!)).toBe(true);
    expect(isPrivateIp(parseIp("172.31.255.1")!)).toBe(true);
    expect(isPrivateIp(parseIp("172.32.0.1")!)).toBe(false);
    expect(isPrivateIp(parseIp("fd00::1")!)).toBe(true);
    expect(isPrivateIp(parseIp("8.8.8.8")!)).toBe(false);
  });
});

describe("resolveIpCountry (CF header first, DB fallback)", () => {
  const dbSays = (country: string | null) => vi.fn(async () => country);

  it("uses the trusted header when the DB agrees or knows nothing", async () => {
    expect(await resolveIpCountry({ ip: "1.1.1.1", cfCountry: "de", trustCfHeader: true }, dbSays(null))).toEqual({
      country: "DE",
      source: "cf-header",
    });
    expect(await resolveIpCountry({ ip: "1.1.1.1", cfCountry: "TR", trustCfHeader: true }, dbSays("TR"))).toEqual({
      country: "TR",
      source: "cf-header",
    });
  });

  it("ignores a forged TR header the DB contradicts (non-proxied root domain)", async () => {
    expect(await resolveIpCountry({ ip: "1.1.1.1", cfCountry: "TR", trustCfHeader: true }, dbSays("US"))).toEqual({
      country: "US",
      source: "db",
    });
  });

  it("keeps a foreign header even if the DB says TR (forging it gains nothing)", async () => {
    expect((await resolveIpCountry({ ip: "1.1.1.1", cfCountry: "NL", trustCfHeader: true }, dbSays("TR"))).country).toBe("NL");
  });

  it("falls back to the DB when the header is untrusted, missing or XX", async () => {
    expect(await resolveIpCountry({ ip: "1.1.1.1", cfCountry: "DE", trustCfHeader: false }, dbSays("TR"))).toEqual({
      country: "TR",
      source: "db",
    });
    expect((await resolveIpCountry({ ip: "1.1.1.1", cfCountry: "XX", trustCfHeader: true }, dbSays(null))).country).toBeNull();
    expect(normalizeCfCountry("T1")).toBe("T1");
  });
});
