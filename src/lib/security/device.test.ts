import { describe, expect, it } from "vitest";
import { countryFromHeaders, deviceFingerprint, ipNetwork, userAgentFamily } from "./device";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const CHROME_MAC_NEXT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const EDGE_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0";

describe("userAgentFamily", () => {
  it.each([
    [CHROME_MAC, "Chrome · macOS"],
    [EDGE_WIN, "Edge · Windows"],
    [SAFARI_IOS, "Safari · iOS"],
    [FIREFOX_LINUX, "Firefox · Linux"],
    ["curl/8.4.0", "Otomatik istemci"],
    ["", "Bilinmeyen tarayıcı"],
    [null, "Bilinmeyen tarayıcı"],
  ])("%s → %s", (ua, family) => {
    expect(userAgentFamily(ua)).toBe(family);
  });
});

describe("ipNetwork", () => {
  it("uses the IPv4 /24 and the IPv6 /48", () => {
    expect(ipNetwork("203.0.113.77")).toBe("203.0.113.0/24");
    expect(ipNetwork("::ffff:198.51.100.9")).toBe("198.51.100.0/24");
    expect(ipNetwork("2001:db8:abcd:12::1")).toBe("2001:db8:abcd::/48");
    expect(ipNetwork("2001:db8::1")).toBe("2001:db8:0::/48");
    expect(ipNetwork("not-an-ip")).toBeNull();
    expect(ipNetwork(null)).toBeNull();
  });
});

describe("countryFromHeaders", () => {
  it("reads cf-ipcountry and ignores unknown / Tor markers", () => {
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "tr" }))).toBe("TR");
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "XX" }))).toBeNull();
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "T1" }))).toBeNull();
    expect(countryFromHeaders(new Headers())).toBeNull();
  });
});

describe("deviceFingerprint", () => {
  it("is stable across browser updates and addresses in the same /24", () => {
    const a = deviceFingerprint({ userAgent: CHROME_MAC, ip: "203.0.113.10" });
    const b = deviceFingerprint({ userAgent: CHROME_MAC_NEXT, ip: "203.0.113.200" });
    expect(a.deviceHash).toBe(b.deviceHash);
  });

  it("changes with another browser family or another network", () => {
    const base = deviceFingerprint({ userAgent: CHROME_MAC, ip: "203.0.113.10" });
    expect(deviceFingerprint({ userAgent: EDGE_WIN, ip: "203.0.113.10" }).deviceHash).not.toBe(base.deviceHash);
    expect(deviceFingerprint({ userAgent: CHROME_MAC, ip: "198.51.100.10" }).deviceHash).not.toBe(base.deviceHash);
  });

  it("prefers the CDN country over the IP prefix (mobile networks hop prefixes)", () => {
    const a = deviceFingerprint({ userAgent: SAFARI_IOS, ip: "203.0.113.10", country: "TR" });
    const b = deviceFingerprint({ userAgent: SAFARI_IOS, ip: "198.51.100.10", country: "TR" });
    expect(a.network).toBe("country:TR");
    expect(a.deviceHash).toBe(b.deviceHash);
  });

  it("binds the browser hash to the UA family only", () => {
    const a = deviceFingerprint({ userAgent: CHROME_MAC, ip: "203.0.113.10" });
    const b = deviceFingerprint({ userAgent: CHROME_MAC_NEXT, ip: "198.51.100.1" });
    expect(a.browserHash).toBe(b.browserHash);
    expect(deviceFingerprint({ userAgent: EDGE_WIN, ip: null }).browserHash).not.toBe(a.browserHash);
  });
});
