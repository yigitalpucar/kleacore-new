process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    domain: { findUnique: vi.fn() },
    dnsRecord: { findFirst: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() },
    dnsZone: { upsert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
  instance: null as unknown,
  module: null as unknown,
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/modules/instances", () => ({
  listActiveInstances: async () => [mocks.instance],
  getInstance: async () => mocks.instance,
  createContract: () => mocks.module,
}));

import { makeTestInstance, restoreFetch } from "@/lib/modules/testing";
import { cloudflareModule, createCloudflareModule, type CloudflareModuleConfig } from "@/lib/modules/dns/cloudflare";
import { createFakeCloudflare } from "@/lib/modules/dns/cloudflare/__fixtures__/fake-api";
import { deleteZoneRecord, ensureDomainZone, isRegisteredThroughUs, nameserversMatch, saveZoneRecord, syncZoneMirror } from "./zones";

const ACCOUNT = "6eaa8900000000000000000000000000";

function useCloudflare() {
  const fake = createFakeCloudflare({ accountId: ACCOUNT });
  mocks.instance = makeTestInstance<CloudflareModuleConfig>(cloudflareModule, { apiToken: "cf-test-token-1234567890", accountId: ACCOUNT }, { id: "inst-cf" });
  mocks.module = createCloudflareModule(mocks.instance as never, { sleep: async () => {} });
  return fake;
}

const zoneRow = { id: "zone-1", domainId: "dom-1", moduleInstanceId: "inst-cf", providerZoneId: "z", nameservers: [] };
const domainWithZone = { id: "dom-1", name: "ornek.com.tr", dnsZone: zoneRow };

beforeEach(() => {
  for (const group of Object.values(mocks.db)) {
    if (typeof group === "function") group.mockReset();
    else for (const fn of Object.values(group)) fn.mockReset();
  }
  mocks.db.dnsRecord.upsert.mockImplementation(async ({ create }: { create: object }) => ({ id: "local-1", ...create }));
  mocks.db.dnsZone.upsert.mockImplementation(async ({ create }: { create: object }) => ({ id: "zone-1", ...create }));
  mocks.db.dnsRecord.deleteMany.mockResolvedValue({ count: 0 });
});
afterEach(() => restoreFetch());

const aRecord = { type: "A" as const, name: "www", fqdn: "www.ornek.com.tr", value: "192.0.2.1", ttl: 1, priority: null, proxied: false };

describe("protected (managed) records", () => {
  it("customers can't edit or delete records KLEACORE manages", async () => {
    useCloudflare();
    mocks.db.domain.findUnique.mockResolvedValue(domainWithZone);
    mocks.db.dnsRecord.findFirst.mockResolvedValue({ id: "r1", providerRecordId: "p1", managedBy: "service:svc-1" });

    const update = await saveZoneRecord("dom-1", aRecord, { recordId: "r1" });
    expect(update).toEqual({ ok: false, error: expect.stringContaining("otomatik yönetiliyor") });
    const removal = await deleteZoneRecord("dom-1", "r1");
    expect(removal).toEqual({ ok: false, error: expect.stringContaining("otomatik yönetiliyor") });
    expect(mocks.db.dnsRecord.delete).not.toHaveBeenCalled();
  });
});

describe("saveZoneRecord / deleteZoneRecord", () => {
  it("creates the record at Cloudflare and mirrors it", async () => {
    const fake = useCloudflare();
    fake.addZone("ornek.com.tr");
    mocks.db.domain.findUnique.mockResolvedValue(domainWithZone);

    const result = await saveZoneRecord("dom-1", { ...aRecord, proxied: true });
    expect(result).toEqual({ ok: true, data: { recordId: "local-1" } });
    expect(fake.records).toHaveLength(1);
    expect(fake.records[0]).toMatchObject({ type: "A", name: "www.ornek.com.tr", proxied: true });
    expect(mocks.db.dnsRecord.upsert.mock.calls[0][0].create).toMatchObject({
      domainId: "dom-1",
      providerRecordId: fake.records[0].id,
      name: "www",
      value: "192.0.2.1",
      proxied: true,
      managedBy: null,
    });
  });

  it("deletes at Cloudflare first, then locally", async () => {
    const fake = useCloudflare();
    const zone = fake.addZone("ornek.com.tr");
    const remote = fake.addRecord(zone.id, { type: "A", name: "www.ornek.com.tr", content: "192.0.2.1" });
    mocks.db.domain.findUnique.mockResolvedValue(domainWithZone);
    mocks.db.dnsRecord.findFirst.mockResolvedValue({ id: "r1", providerRecordId: remote.id, managedBy: null });

    expect(await deleteZoneRecord("dom-1", "r1")).toEqual({ ok: true, data: undefined });
    expect(fake.records).toHaveLength(0);
    expect(mocks.db.dnsRecord.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
  });

  it("returns the Turkish Cloudflare error and keeps the local row", async () => {
    const fake = useCloudflare();
    const zone = fake.addZone("ornek.com.tr");
    fake.addRecord(zone.id, { type: "CNAME", name: "www.ornek.com.tr", content: "x.example.net" });
    mocks.db.domain.findUnique.mockResolvedValue(domainWithZone);

    const result = await saveZoneRecord("dom-1", aRecord);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("CNAME") });
    expect(mocks.db.dnsRecord.upsert).not.toHaveBeenCalled();
  });
});

describe("syncZoneMirror", () => {
  it("upserts every provider record and removes vanished ones", async () => {
    const fake = useCloudflare();
    const zone = fake.addZone("ornek.com.tr");
    const a = fake.addRecord(zone.id, { type: "A", name: "ornek.com.tr", content: "192.0.2.1" });
    const mx = fake.addRecord(zone.id, { type: "MX", name: "ornek.com.tr", content: "mail.ornek.com.tr", priority: 10 });
    fake.addRecord(zone.id, { type: "TXT", name: "ornek.com.tr", content: "v=spf1 -all" });
    mocks.db.domain.findUnique.mockResolvedValue(domainWithZone);

    expect(await syncZoneMirror("dom-1")).toEqual({ ok: true, data: { count: 3 } });
    expect(mocks.db.dnsRecord.upsert).toHaveBeenCalledTimes(3);
    const txt = mocks.db.dnsRecord.upsert.mock.calls.find(([args]) => args.create.type === "TXT")![0];
    expect(txt.create).toMatchObject({ name: "@", value: "v=spf1 -all" });
    // managedBy is never cleared by a sync.
    expect(txt.update).not.toHaveProperty("managedBy");
    expect(mocks.db.dnsRecord.deleteMany).toHaveBeenCalledWith({
      where: { domainId: "dom-1", OR: [{ providerRecordId: null }, { providerRecordId: { notIn: expect.arrayContaining([a.id, mx.id]) } }] },
    });
  });
});

describe("ensureDomainZone", () => {
  it("creates the zone, stores nameservers and copies the legacy records once", async () => {
    const fake = useCloudflare();
    mocks.db.domain.findUnique.mockResolvedValue({ id: "dom-1", name: "ornek.com.tr", dnsZone: null });
    mocks.db.dnsRecord.findMany.mockResolvedValue([
      { id: "old-1", type: "A", name: "@", value: "192.0.2.50", ttl: 3600, priority: null, providerRecordId: null },
      { id: "old-2", type: "MX", name: "@", value: "mx.example.net", ttl: 3600, priority: 5, providerRecordId: null },
      { id: "old-3", type: "A", name: "bozuk", value: "not-an-ip", ttl: 3600, priority: null, providerRecordId: null },
    ]);

    // The mirror sync after creation looks the domain up again (now with a zone).
    mocks.db.domain.findUnique
      .mockResolvedValueOnce({ id: "dom-1", name: "ornek.com.tr", dnsZone: null })
      .mockResolvedValue(domainWithZone);

    const result = await ensureDomainZone("dom-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.created).toBe(true);
    expect(mocks.db.dnsZone.upsert.mock.calls[0][0].create).toMatchObject({
      domainId: "dom-1",
      moduleInstanceId: "inst-cf",
      nameservers: ["isaac.ns.cloudflare.com", "luciane.ns.cloudflare.com"],
      status: "PENDING",
      providerStatus: "pending",
    });
    expect(fake.records.map((r) => `${r.type} ${r.name} ${r.content}`).sort()).toEqual([
      "A ornek.com.tr 192.0.2.50",
      "MX ornek.com.tr mx.example.net",
    ]);
    expect(result.data.importErrors).toEqual([expect.stringContaining("A bozuk")]);
  });

  it("reports a Turkish error when no DNS module is configured", async () => {
    mocks.instance = undefined;
    mocks.db.domain.findUnique.mockResolvedValue({ id: "dom-1", name: "ornek.com.tr", dnsZone: null });
    const result = await ensureDomainZone("dom-1");
    expect(result).toEqual({ ok: false, error: expect.stringContaining("DNS modülü") });
  });
});

describe("helpers", () => {
  it("compares nameserver sets case/order-insensitively", () => {
    expect(nameserversMatch(["LUCIANE.ns.cloudflare.com.", "isaac.ns.cloudflare.com"], ["isaac.ns.cloudflare.com", "luciane.ns.cloudflare.com"])).toBe(true);
    expect(nameserversMatch(["ns1.kleacore.com", "ns2.kleacore.com"], ["isaac.ns.cloudflare.com", "luciane.ns.cloudflare.com"])).toBe(false);
    expect(nameserversMatch([], [])).toBe(false);
  });

  it("knows which domains we registered (Gri)", () => {
    expect(isRegisteredThroughUs("Gri")).toBe(true);
    expect(isRegisteredThroughUs("gri")).toBe(true);
    expect(isRegisteredThroughUs("KLEACORE")).toBe(true);
    expect(isRegisteredThroughUs("GoDaddy")).toBe(false);
  });
});
