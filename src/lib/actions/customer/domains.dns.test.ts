import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  provider: "registrar" as "registrar" | "cloudflare",
  db: {
    domain: { findUnique: vi.fn(), update: vi.fn() },
    dnsRecord: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    domainLifecycleEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  updateRegistrarDnsRecords: vi.fn(),
  updateRegistrarNameservers: vi.fn(),
  saveZoneRecord: vi.fn(),
  deleteZoneRecord: vi.fn(),
  ensureDomainZone: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/utils/auth-helpers", () => ({ requireCustomer: async () => ({ user: { id: "cust-1" } }) }));
vi.mock("@/lib/integrations/registrar", () => ({
  updateRegistrarDnsRecords: mocks.updateRegistrarDnsRecords,
  updateRegistrarNameservers: mocks.updateRegistrarNameservers,
}));
vi.mock("@/lib/dns/settings", () => ({ getDnsDefaultProvider: async () => mocks.provider }));
vi.mock("@/lib/dns/zones", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dns/zones")>()),
  saveZoneRecord: mocks.saveZoneRecord,
  deleteZoneRecord: mocks.deleteZoneRecord,
  ensureDomainZone: mocks.ensureDomainZone,
}));

import {
  addDnsRecord,
  deleteDnsRecord,
  enableCloudflareDns,
  switchNameserversToCloudflare,
  updateDnsRecord,
} from "./domains";

const legacyDomain = {
  id: "dom-1",
  name: "ornek.com.tr",
  customerId: "cust-1",
  registrar: "Gri",
  status: "ACTIVE",
  nameservers: ["ns1.kleacore.com", "ns2.kleacore.com"],
  dnsRecords: [],
  dnsZone: null as null | { id: string; nameservers: string[] },
};
const cfZone = { id: "zone-1", nameservers: ["isaac.ns.cloudflare.com", "luciane.ns.cloudflare.com"] };

beforeEach(() => {
  mocks.provider = "registrar";
  for (const group of Object.values(mocks.db)) {
    if (typeof group === "function") group.mockReset();
    else for (const fn of Object.values(group)) fn.mockReset();
  }
  for (const fn of [mocks.updateRegistrarDnsRecords, mocks.updateRegistrarNameservers, mocks.saveZoneRecord, mocks.deleteZoneRecord, mocks.ensureDomainZone]) {
    fn.mockReset();
  }
  mocks.db.domain.findUnique.mockResolvedValue(legacyDomain);
  mocks.db.dnsRecord.create.mockResolvedValue({ id: "rec-1" });
  mocks.db.dnsRecord.findMany.mockResolvedValue([]);
  mocks.updateRegistrarDnsRecords.mockResolvedValue({ ok: true });
});

describe("customer DNS actions — registrar mode (no zone, unchanged flow)", () => {
  it("stores the record locally and syncs the registrar", async () => {
    const result = await addDnsRecord("dom-1", { type: "A", name: "www", value: "192.0.2.10", ttl: 3600 });
    expect(result).toMatchObject({ success: true, recordId: "rec-1" });
    expect(mocks.db.dnsRecord.create).toHaveBeenCalledWith({
      data: { domainId: "dom-1", type: "A", name: "www", value: "192.0.2.10", ttl: 3600, priority: null },
    });
    expect(mocks.updateRegistrarDnsRecords).toHaveBeenCalled();
    expect(mocks.saveZoneRecord).not.toHaveBeenCalled();
  });

  it("rejects invalid values with a type-specific Turkish message", async () => {
    const result = await addDnsRecord("dom-1", { type: "A", name: "www", value: "mail.ornek.com.tr" });
    expect(result).toEqual({ success: false, error: expect.stringContaining("IPv4") });
    expect(mocks.db.dnsRecord.create).not.toHaveBeenCalled();
  });

  it("refuses another customer's domain", async () => {
    mocks.db.domain.findUnique.mockResolvedValue({ ...legacyDomain, customerId: "someone-else" });
    expect(await addDnsRecord("dom-1", { type: "A", name: "@", value: "192.0.2.1" })).toEqual({
      success: false,
      error: "Bu alan adına erişim yetkiniz yok",
    });
  });
});

describe("customer DNS actions — Cloudflare zone", () => {
  beforeEach(() => {
    mocks.db.domain.findUnique.mockResolvedValue({ ...legacyDomain, dnsZone: cfZone });
  });

  it("writes through Cloudflare with proxy + auto TTL, never to the registrar", async () => {
    mocks.saveZoneRecord.mockResolvedValue({ ok: true, data: { recordId: "rec-9" } });
    const result = await addDnsRecord("dom-1", { type: "CNAME", name: "blog", value: "hedef.example.net", ttl: 1, proxied: true });
    expect(result).toEqual({ success: true, recordId: "rec-9" });
    expect(mocks.saveZoneRecord).toHaveBeenCalledWith("dom-1", {
      type: "CNAME",
      name: "blog",
      fqdn: "blog.ornek.com.tr",
      value: "hedef.example.net",
      ttl: 1,
      priority: null,
      proxied: true,
    });
    expect(mocks.updateRegistrarDnsRecords).not.toHaveBeenCalled();
    expect(mocks.db.dnsRecord.create).not.toHaveBeenCalled();
  });

  it("passes the record id on update and surfaces protected/Cloudflare errors", async () => {
    mocks.saveZoneRecord.mockResolvedValue({ ok: false, error: "Bu kayıt hosting/sunucu hizmetiniz için otomatik yönetiliyor; değiştirilemez veya silinemez." });
    const result = await updateDnsRecord("dom-1", "rec-1", { type: "A", name: "@", value: "192.0.2.1", ttl: 1 });
    expect(result).toEqual({ success: false, error: expect.stringContaining("otomatik yönetiliyor") });
    expect(mocks.saveZoneRecord).toHaveBeenCalledWith("dom-1", expect.objectContaining({ fqdn: "ornek.com.tr" }), { recordId: "rec-1" });

    mocks.deleteZoneRecord.mockResolvedValue({ ok: true, data: undefined });
    expect(await deleteDnsRecord("dom-1", "rec-1")).toEqual({ success: true });
    expect(mocks.db.dnsRecord.delete).not.toHaveBeenCalled();
  });
});

describe("enableCloudflareDns", () => {
  it("is closed while dns_default_provider is registrar", async () => {
    const result = await enableCloudflareDns("dom-1");
    expect(result).toEqual({ success: false, error: "Cloudflare DNS yönetimi şu anda kullanıma açık değil" });
    expect(mocks.ensureDomainZone).not.toHaveBeenCalled();
  });

  it("creates the zone in cloudflare mode", async () => {
    mocks.provider = "cloudflare";
    mocks.ensureDomainZone.mockResolvedValue({ ok: true, data: { zone: cfZone, created: true, importErrors: [] } });
    expect(await enableCloudflareDns("dom-1")).toEqual({ success: true, nameservers: cfZone.nameservers, importErrors: [] });
  });
});

describe("switchNameserversToCloudflare", () => {
  it("calls the registrar with the zone's nameservers and records it", async () => {
    mocks.db.domain.findUnique.mockResolvedValue({ ...legacyDomain, dnsZone: cfZone });
    mocks.updateRegistrarNameservers.mockResolvedValue({ ok: true, provider: "gri" });
    mocks.db.domain.update.mockReturnValue("update-op");
    mocks.db.domainLifecycleEvent.create.mockReturnValue("event-op");
    mocks.db.$transaction.mockResolvedValue([]);

    expect(await switchNameserversToCloudflare("dom-1")).toEqual({ success: true, unchanged: false });
    expect(mocks.updateRegistrarNameservers).toHaveBeenCalledWith({ domain: "ornek.com.tr", nameservers: cfZone.nameservers });
    expect(mocks.db.domain.update).toHaveBeenCalledWith({ where: { id: "dom-1" }, data: { nameservers: cfZone.nameservers } });
    expect(mocks.db.$transaction).toHaveBeenCalledWith(["update-op", "event-op"]);
  });

  it("doesn't touch the registrar when already pointed, or for other registrars / no zone", async () => {
    mocks.db.domain.findUnique.mockResolvedValue({ ...legacyDomain, nameservers: [...cfZone.nameservers].reverse(), dnsZone: cfZone });
    expect(await switchNameserversToCloudflare("dom-1")).toEqual({ success: true, unchanged: true });

    mocks.db.domain.findUnique.mockResolvedValue({ ...legacyDomain, registrar: "GoDaddy", dnsZone: cfZone });
    expect(await switchNameserversToCloudflare("dom-1")).toMatchObject({ success: false });

    mocks.db.domain.findUnique.mockResolvedValue(legacyDomain);
    expect(await switchNameserversToCloudflare("dom-1")).toEqual({ success: false, error: "Önce DNS bölgesini oluşturun" });
    expect(mocks.updateRegistrarNameservers).not.toHaveBeenCalled();
  });

  it("reports a registrar refusal", async () => {
    mocks.db.domain.findUnique.mockResolvedValue({ ...legacyDomain, dnsZone: cfZone });
    mocks.updateRegistrarNameservers.mockResolvedValue({ ok: false, error: "GRI_HTTP_422" });
    expect(await switchNameserversToCloudflare("dom-1")).toEqual({
      success: false,
      error: "Kayıt firması nameserver değişikliğini kabul etmedi: GRI_HTTP_422",
    });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
});
