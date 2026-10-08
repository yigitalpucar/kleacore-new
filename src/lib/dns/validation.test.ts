import { describe, expect, it } from "vitest";
import { relativeRecordName, resolveRecordName, validateDnsRecord, type DnsRecordFormInput, type DnsValidationOptions } from "./validation";

const zone = "ornek.com.tr";
const cf: DnsValidationOptions = { provider: "cloudflare" };
const registrar: DnsValidationOptions = { provider: "registrar" };

function check(input: Partial<DnsRecordFormInput>, options = cf) {
  return validateDnsRecord({ type: "A", name: "@", value: "192.0.2.10", ...input }, zone, options);
}

function errorOf(input: Partial<DnsRecordFormInput>, options = cf) {
  const result = check(input, options);
  return result.ok ? null : { field: result.field, error: result.error };
}

describe("resolveRecordName", () => {
  it("normalises apex, relative and absolute names", () => {
    expect(resolveRecordName("@", zone)).toEqual({ name: "@", fqdn: zone });
    expect(resolveRecordName("", zone)).toEqual({ name: "@", fqdn: zone });
    expect(resolveRecordName("ornek.com.tr.", zone)).toEqual({ name: "@", fqdn: zone });
    expect(resolveRecordName("WWW", zone)).toEqual({ name: "www", fqdn: "www.ornek.com.tr" });
    expect(resolveRecordName("blog.ornek.com.tr", zone)).toEqual({ name: "blog", fqdn: "blog.ornek.com.tr" });
    expect(resolveRecordName("*.dev", zone)).toEqual({ name: "*.dev", fqdn: "*.dev.ornek.com.tr" });
    expect(resolveRecordName("_dmarc", zone)).toEqual({ name: "_dmarc", fqdn: "_dmarc.ornek.com.tr" });
  });

  it("converts IDN labels to punycode", () => {
    expect(resolveRecordName("çiçek", zone)).toEqual({ name: "xn--iek-1lab", fqdn: "xn--iek-1lab.ornek.com.tr" });
  });

  it("rejects names outside the zone and bad labels", () => {
    expect(resolveRecordName("www.baska.com.", zone)).toHaveProperty("error");
    expect(resolveRecordName("a b", zone)).toHaveProperty("error");
    expect(resolveRecordName("-www", zone)).toHaveProperty("error");
    expect(resolveRecordName("www.*", zone)).toHaveProperty("error");
    expect(resolveRecordName(`${"a".repeat(64)}`, zone)).toHaveProperty("error");
  });

  it("shows stored names relative to the zone", () => {
    expect(relativeRecordName("ornek.com.tr", zone)).toBe("@");
    expect(relativeRecordName("www.ornek.com.tr", zone)).toBe("www");
    expect(relativeRecordName("www", zone)).toBe("www");
  });
});

describe("validateDnsRecord", () => {
  it("accepts a valid A record with auto TTL on Cloudflare", () => {
    expect(check({ name: "www" })).toEqual({
      ok: true,
      record: { type: "A", name: "www", fqdn: "www.ornek.com.tr", value: "192.0.2.10", ttl: 1, priority: null, proxied: false },
    });
  });

  it("checks addresses per type", () => {
    expect(errorOf({ value: "300.1.1.1" })?.field).toBe("value");
    expect(errorOf({ value: "192.0.2" })?.error).toContain("IPv4");
    expect(errorOf({ value: "01.2.3.4" })?.field).toBe("value");
    expect(errorOf({ type: "AAAA", value: "2001:db8::10" })).toBeNull();
    expect(errorOf({ type: "AAAA", value: "192.0.2.1" })?.error).toContain("IPv6");
    expect(errorOf({ type: "AAAA", value: "2001:db8:::1" })?.field).toBe("value");
  });

  it("requires host names for CNAME/MX/NS", () => {
    expect(errorOf({ type: "CNAME", name: "blog", value: "192.0.2.1" })?.error).toContain("IP adresi olamaz");
    expect(errorOf({ type: "CNAME", name: "blog", value: "blog.ornek.com.tr" })?.error).toContain("kendisini");
    const cname = check({ type: "CNAME", name: "blog", value: "Hedef.Example.NET." });
    expect(cname.ok && cname.record.value).toBe("hedef.example.net");
    expect(errorOf({ type: "MX", value: "mail.ornek.com.tr", priority: null })?.field).toBe("priority");
    expect(errorOf({ type: "MX", value: "mail.ornek.com.tr", priority: 70000 })?.field).toBe("priority");
    expect(errorOf({ type: "MX", value: "mail.ornek.com.tr", priority: 10 })).toBeNull();
    expect(errorOf({ type: "NS", name: "@", value: "ns1.example.com" })?.field).toBe("name");
    expect(errorOf({ type: "NS", name: "sub", value: "ns1.example.com" })).toBeNull();
  });

  it("validates SRV name, value and priority", () => {
    expect(errorOf({ type: "SRV", name: "sip", value: "5 5060 sip.ornek.com.tr", priority: 10 })?.field).toBe("name");
    expect(errorOf({ type: "SRV", name: "_sip._tcp", value: "5060 sip.ornek.com.tr", priority: 10 })?.field).toBe("value");
    expect(errorOf({ type: "SRV", name: "_sip._tcp", value: "5 99999 sip.ornek.com.tr", priority: 10 })?.field).toBe("value");
    const srv = check({ type: "SRV", name: "_sip._tcp", value: "5  5060  SIP.ornek.com.tr.", priority: 10 });
    expect(srv.ok && srv.record).toMatchObject({ value: "5 5060 sip.ornek.com.tr", priority: 10, fqdn: "_sip._tcp.ornek.com.tr" });
  });

  it("validates CAA and normalises its value", () => {
    expect(errorOf({ type: "CAA", value: "issue letsencrypt.org" })?.field).toBe("value");
    expect(errorOf({ type: "CAA", value: "0 issuer letsencrypt.org" })?.error).toContain("issue, issuewild veya iodef");
    const caa = check({ type: "CAA", value: "0 ISSUE letsencrypt.org" });
    expect(caa.ok && caa.record.value).toBe('0 issue "letsencrypt.org"');
  });

  it("limits TXT length and keeps the text as entered", () => {
    expect(errorOf({ type: "TXT", value: "x".repeat(2049) })?.field).toBe("value");
    const txt = check({ type: "TXT", value: "v=spf1 include:_spf.google.com ~all" });
    expect(txt.ok && txt.record.value).toBe("v=spf1 include:_spf.google.com ~all");
  });

  it("allows auto TTL only on Cloudflare and checks the range", () => {
    expect(errorOf({ ttl: 1 }, registrar)?.field).toBe("ttl");
    expect(errorOf({ ttl: 30 })?.field).toBe("ttl");
    expect(errorOf({ ttl: 90000 })?.field).toBe("ttl");
    const legacy = check({}, registrar);
    expect(legacy.ok && legacy.record.ttl).toBe(3600);
  });

  it("only proxies A/AAAA/CNAME on Cloudflare and forces auto TTL", () => {
    const proxied = check({ proxied: true, ttl: 3600 });
    expect(proxied.ok && proxied.record).toMatchObject({ proxied: true, ttl: 1 });
    expect(errorOf({ type: "TXT", value: "x", proxied: true })?.field).toBe("proxied");
    expect(errorOf({ proxied: true }, registrar)?.field).toBe("proxied");
    expect(errorOf({ name: "*", proxied: true })?.field).toBe("proxied");
  });

  it("rejects unknown types and empty values", () => {
    expect(errorOf({ type: "PTR" })?.field).toBe("type");
    expect(errorOf({ value: "  " })?.field).toBe("value");
  });

  it("drops a priority on types that don't use it", () => {
    const result = check({ priority: 5 });
    expect(result.ok && result.record.priority).toBeNull();
  });
});
