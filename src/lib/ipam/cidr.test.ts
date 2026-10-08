import { describe, expect, it } from "vitest";
import { CidrError, expandCidr, intToIpv4, ipv4ToInt, parseCidr, parseIpRanges, prefixToNetmask } from "./cidr";

describe("IPv4 CIDR helpers", () => {
  it("converts addresses to integers and back", () => {
    expect(ipv4ToInt("188.132.235.10")).toBe(3162827530);
    expect(intToIpv4(3162827530)).toBe("188.132.235.10");
    expect(intToIpv4(ipv4ToInt("255.255.255.255"))).toBe("255.255.255.255");
    expect(() => ipv4ToInt("256.1.1.1")).toThrow(CidrError);
    expect(() => ipv4ToInt("01.2.3.4")).toThrow(CidrError);
  });

  it("parses a block with netmask and broadcast", () => {
    expect(parseCidr("188.132.235.64/26")).toMatchObject({
      cidr: "188.132.235.64/26",
      network: "188.132.235.64",
      broadcast: "188.132.235.127",
      netmask: "255.255.255.192",
      prefix: 26,
      size: 64,
    });
    expect(prefixToNetmask(24)).toBe("255.255.255.0");
    expect(prefixToNetmask(32)).toBe("255.255.255.255");
    expect(prefixToNetmask(0)).toBe("0.0.0.0");
  });

  it("rejects malformed blocks and host bits", () => {
    expect(() => parseCidr("10.0.0.0")).toThrow(/Geçersiz CIDR/);
    expect(() => parseCidr("10.0.0.0/33")).toThrow(/önek/);
    expect(() => parseCidr("10.0.0.5/24")).toThrow(/10\.0\.0\.0\/24 mü/);
  });

  it("expands usable hosts without network, broadcast and gateway", () => {
    const hosts = expandCidr("192.0.2.0/29", { gateway: "192.0.2.1" });
    expect(hosts.map((h) => h.address)).toEqual(["192.0.2.2", "192.0.2.3", "192.0.2.4", "192.0.2.5", "192.0.2.6"]);
    expect(hosts.every((h) => !h.reserved)).toBe(true);
    expect(hosts[0].sortKey).toBe(ipv4ToInt("192.0.2.2"));
  });

  it("marks reserved ranges and single addresses", () => {
    const ranges = parseIpRanges("192.0.2.2-192.0.2.3\n192.0.2.6");
    const hosts = expandCidr("192.0.2.0/29", { gateway: "192.0.2.1", reservedRanges: ranges });
    expect(hosts.filter((h) => h.reserved).map((h) => h.address)).toEqual(["192.0.2.2", "192.0.2.3", "192.0.2.6"]);
    expect(() => parseIpRanges("192.0.2.9-192.0.2.3")).toThrow(/Geçersiz aralık/);
  });

  it("uses every address of /31 and /32 (RFC 3021)", () => {
    expect(expandCidr("192.0.2.0/31").map((h) => h.address)).toEqual(["192.0.2.0", "192.0.2.1"]);
    expect(expandCidr("192.0.2.7/32").map((h) => h.address)).toEqual(["192.0.2.7"]);
  });

  it("caps pool size at /20", () => {
    expect(expandCidr("10.0.0.0/20")).toHaveLength(4094);
    expect(() => expandCidr("10.0.0.0/19")).toThrow(/en fazla 4096/);
  });
});
