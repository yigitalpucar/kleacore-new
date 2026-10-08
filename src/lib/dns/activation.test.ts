process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  provider: "registrar" as "registrar" | "cloudflare",
  enqueue: vi.fn(),
  ensureDomainZone: vi.fn(),
  mirrorRecord: vi.fn(),
  syncZoneMirror: vi.fn(),
  createContract: vi.fn(),
  settings: new Map<string, string>(),
  whmHost: "",
  db: {
    service: { findUnique: vi.fn() },
    domain: { findMany: vi.fn() },
    server: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/jobs/enqueue", () => ({ enqueue: mocks.enqueue }));
vi.mock("./settings", () => ({
  DNS_HOSTING_IP_SETTING: "dns_hosting_ip",
  getDnsDefaultProvider: async () => mocks.provider,
}));
vi.mock("@/lib/integrations/settings", () => ({
  getSettingValue: async (key: string) => mocks.settings.get(key) ?? "",
}));
vi.mock("@/lib/integrations/provisioning/config", () => ({
  getCpanelWhmConfig: async () => ({ host: mocks.whmHost }),
}));
vi.mock("@/lib/provisioning/activation-notice", () => ({
  activationKindForCategory: (slug: string) =>
    slug === "hosting" ? "hosting" : ["vds", "vps"].includes(slug) ? "server" : "other",
}));
vi.mock("@/lib/modules/instances", () => ({ createContract: mocks.createContract }));
vi.mock("./zones", () => ({
  ensureDomainZone: mocks.ensureDomainZone,
  mirrorRecord: mocks.mirrorRecord,
  syncZoneMirror: mocks.syncZoneMirror,
  resolveDnsInstance: async () => ({ id: "inst-cf" }),
  serviceManagedKey: (id: string) => `service:${id}`,
}));

import { makeTestInstance, restoreFetch } from "@/lib/modules/testing";
import { cloudflareModule, createCloudflareModule, type CloudflareModuleConfig } from "@/lib/modules/dns/cloudflare";
import { createFakeCloudflare } from "@/lib/modules/dns/cloudflare/__fixtures__/fake-api";
import {
  applyRecordPlan,
  dnsHostForService,
  planServiceRecords,
  queueServiceDnsSetup,
  resolveHostingIp,
  runServiceDnsSetup,
} from "./activation";

const ACCOUNT = "6eaa8900000000000000000000000000";
const cfConfig = { apiToken: "cf-test-token-1234567890", accountId: ACCOUNT };

function cloudflare() {
  const fake = createFakeCloudflare({ accountId: ACCOUNT, pageSize: 3 });
  const zone = fake.addZone("ornek.com.tr");
  const dns = createCloudflareModule(makeTestInstance<CloudflareModuleConfig>(cloudflareModule, cfConfig), {
    sleep: async () => {},
  });
  return { fake, zone, dns };
}

const hostingService: {
  id: string;
  customerId: string;
  domain: string | null;
  serverName: string | null;
  ipAddress: string | null;
  moduleInstanceId: string | null;
  status: string;
  product: { category: { slug: string } };
} = {
  id: "svc-1",
  customerId: "cust-1",
  domain: "ornek.com.tr",
  serverName: "ornekcom",
  ipAddress: null,
  moduleInstanceId: "inst-whm",
  status: "ACTIVE",
  product: { category: { slug: "hosting" } },
};

const ownedDomain = { id: "dom-1", name: "ornek.com.tr", customerId: "cust-1", dnsZone: null as null | { id: string } };

beforeEach(() => {
  mocks.provider = "registrar";
  mocks.settings.clear();
  mocks.whmHost = "";
  for (const fn of [mocks.enqueue, mocks.ensureDomainZone, mocks.mirrorRecord, mocks.syncZoneMirror, mocks.createContract]) fn.mockReset();
  for (const group of Object.values(mocks.db)) for (const fn of Object.values(group)) fn.mockReset();
  mocks.enqueue.mockResolvedValue({ id: "job-1", deduplicated: false });
  mocks.syncZoneMirror.mockResolvedValue({ ok: true, data: { count: 0 } });
});
afterEach(() => restoreFetch());

describe("dnsHostForService", () => {
  it("uses the domain for hosting and the chosen hostname for servers", () => {
    expect(dnsHostForService({ domain: "Ornek.com.tr.", serverName: "x" }, "hosting")).toBe("ornek.com.tr");
    expect(dnsHostForService({ domain: null, serverName: "vds1.ornek.com.tr" }, "server")).toBe("vds1.ornek.com.tr");
    expect(dnsHostForService({ domain: "vds.ornek.com.tr", serverName: "ornekvds" }, "server")).toBe("vds.ornek.com.tr");
    expect(dnsHostForService({ domain: "ornek.com.tr", serverName: null }, "other")).toBeNull();
  });
});

describe("queueServiceDnsSetup", () => {
  it("queues nothing in registrar mode when the domain has no zone (production default)", async () => {
    mocks.db.domain.findMany.mockResolvedValue([ownedDomain]);
    const result = await queueServiceDnsSetup(undefined, hostingService, "hosting");
    expect(result).toEqual({ queued: false, reason: "DNS_NOT_MANAGED" });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("queues in cloudflare mode, idempotent per service and inside the given transaction", async () => {
    mocks.provider = "cloudflare";
    const tx = { domain: { findMany: vi.fn().mockResolvedValue([ownedDomain]) } };
    const result = await queueServiceDnsSetup(tx as never, hostingService, "hosting");
    expect(result).toEqual({ queued: true });
    expect(mocks.enqueue).toHaveBeenCalledWith("dns.service-setup", { serviceId: "svc-1" }, { singletonKey: "svc-1", tx });
    expect(tx.domain.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: "cust-1", name: { in: ["ornek.com.tr", "com.tr"] } } })
    );
  });

  it("queues in registrar mode when an admin already moved the domain to a zone", async () => {
    mocks.db.domain.findMany.mockResolvedValue([{ ...ownedDomain, dnsZone: { id: "zone-1" } }]);
    expect(await queueServiceDnsSetup(undefined, hostingService, "hosting")).toEqual({ queued: true });
  });

  it("skips domains the customer doesn't own and categories without DNS", async () => {
    mocks.provider = "cloudflare";
    mocks.db.domain.findMany.mockResolvedValue([]);
    expect(await queueServiceDnsSetup(undefined, hostingService, "hosting")).toEqual({ queued: false, reason: "NOT_OUR_DOMAIN" });
    expect(await queueServiceDnsSetup(undefined, hostingService, "ssl")).toEqual({ queued: false, reason: "NO_HOST" });
  });

  it("never throws when queueing fails", async () => {
    mocks.provider = "cloudflare";
    mocks.db.domain.findMany.mockResolvedValue([ownedDomain]);
    mocks.enqueue.mockRejectedValue(new Error("boss down"));
    expect(await queueServiceDnsSetup(undefined, hostingService, "hosting")).toEqual({ queued: false, reason: "QUEUE_ERROR" });
  });
});

describe("resolveHostingIp", () => {
  it("prefers the service IP, then the instance's server, then the legacy WHM host, then the setting", async () => {
    expect(await resolveHostingIp({ ipAddress: "192.0.2.5", moduleInstanceId: null })).toBe("192.0.2.5");

    mocks.db.server.findFirst.mockResolvedValueOnce({ ipAddress: "192.0.2.6" });
    expect(await resolveHostingIp({ ipAddress: null, moduleInstanceId: "inst-whm" })).toBe("192.0.2.6");

    mocks.whmHost = "https://whm.kleacore.com:2087";
    mocks.db.server.findFirst.mockResolvedValueOnce({ ipAddress: "192.0.2.7" });
    expect(await resolveHostingIp({ ipAddress: null, moduleInstanceId: null })).toBe("192.0.2.7");
    expect(mocks.db.server.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { OR: [{ hostname: "whm.kleacore.com" }, { ipAddress: "whm.kleacore.com" }] } })
    );

    mocks.whmHost = "";
    mocks.settings.set("dns_hosting_ip", "192.0.2.8");
    expect(await resolveHostingIp({ ipAddress: null, moduleInstanceId: null })).toBe("192.0.2.8");
    mocks.settings.set("dns_hosting_ip", "not-an-ip");
    expect(await resolveHostingIp({ ipAddress: null, moduleInstanceId: null })).toBeNull();
  });
});

describe("applyRecordPlan (Cloudflare fake API)", () => {
  it("creates @, www, mail A + MX + SPF for hosting and is idempotent", async () => {
    const { fake, dns } = cloudflare();
    const plan = planServiceRecords("hosting", "ornek.com.tr", "192.0.2.10");
    const first = await applyRecordPlan(dns, "ornek.com.tr", plan);
    expect(first.written).toHaveLength(5);
    const snapshot = fake.records.map((r) => `${r.type} ${r.name} ${r.content}`).sort();
    expect(snapshot).toEqual([
      "A mail.ornek.com.tr 192.0.2.10",
      "A ornek.com.tr 192.0.2.10",
      "A www.ornek.com.tr 192.0.2.10",
      "MX ornek.com.tr mail.ornek.com.tr",
      'TXT ornek.com.tr "v=spf1 +a +mx +ip4:192.0.2.10 ~all"',
    ]);
    expect(fake.records.every((r) => !r.proxied)).toBe(true);

    const writesBefore = fake.writes().length;
    const second = await applyRecordPlan(dns, "ornek.com.tr", plan);
    expect(fake.records).toHaveLength(5);
    expect(fake.writes()).toHaveLength(writesBefore);
    expect(second.skipped).toEqual(["MX ornek.com.tr (mevcut MX korunuyor)", "SPF ornek.com.tr (mevcut SPF korunuyor)"]);
  });

  it("keeps the customer's MX and SPF, replaces old web addresses and a www CNAME", async () => {
    const { fake, zone, dns } = cloudflare();
    fake.addRecord(zone.id, { type: "MX", name: "ornek.com.tr", content: "aspmx.l.google.com", priority: 1, ttl: 1 });
    fake.addRecord(zone.id, { type: "TXT", name: "ornek.com.tr", content: "v=spf1 include:_spf.google.com ~all", ttl: 1 });
    fake.addRecord(zone.id, { type: "A", name: "ornek.com.tr", content: "198.51.100.1", ttl: 1 });
    fake.addRecord(zone.id, { type: "CNAME", name: "www.ornek.com.tr", content: "eski.example.net", ttl: 1 });

    await applyRecordPlan(dns, "ornek.com.tr", planServiceRecords("hosting", "ornek.com.tr", "192.0.2.10"));
    const byName = (type: string, name: string) => fake.records.filter((r) => r.type === type && r.name === name).map((r) => r.content);
    expect(byName("A", "ornek.com.tr")).toEqual(["192.0.2.10"]);
    expect(byName("CNAME", "www.ornek.com.tr")).toEqual([]);
    expect(byName("A", "www.ornek.com.tr")).toEqual(["192.0.2.10"]);
    expect(byName("MX", "ornek.com.tr")).toEqual(["aspmx.l.google.com"]);
    expect(byName("TXT", "ornek.com.tr")).toEqual(['"v=spf1 include:_spf.google.com ~all"']);
  });

  it("uses AAAA and ip6 for an IPv6 server and only the hostname for VDS", () => {
    expect(planServiceRecords("hosting", "ornek.com.tr", "2001:db8::10")[4].record.content).toBe("v=spf1 +a +mx +ip6:2001:db8::10 ~all");
    expect(planServiceRecords("server", "vds1.ornek.com.tr", "2001:db8::10")).toEqual([
      { record: { type: "AAAA", name: "vds1.ornek.com.tr", content: "2001:db8::10", proxied: false }, replaceAddress: true },
    ]);
  });
});

describe("runServiceDnsSetup (dns.service-setup job)", () => {
  function setup(service = hostingService, domain = ownedDomain) {
    const cf = cloudflare();
    mocks.db.service.findUnique.mockResolvedValue(service);
    mocks.db.domain.findMany.mockResolvedValue([domain]);
    mocks.ensureDomainZone.mockResolvedValue({ ok: true, data: { zone: { id: "zone-1", moduleInstanceId: "inst-cf" }, created: true, importErrors: [] } });
    mocks.createContract.mockReturnValue(cf.dns);
    return cf;
  }

  it("does nothing in registrar mode without a zone", async () => {
    setup();
    expect(await runServiceDnsSetup("svc-1")).toEqual({ status: "skipped", reason: "DNS_NOT_MANAGED" });
    expect(mocks.ensureDomainZone).not.toHaveBeenCalled();
  });

  it("ensures the zone, writes hosting records and marks them protected", async () => {
    mocks.provider = "cloudflare";
    mocks.settings.set("dns_hosting_ip", "192.0.2.10");
    const { fake } = setup();
    const outcome = await runServiceDnsSetup("svc-1");
    expect(outcome).toEqual({ status: "done", zone: "ornek.com.tr", written: 5, skipped: [] });
    expect(mocks.ensureDomainZone).toHaveBeenCalledWith("dom-1");
    expect(fake.records).toHaveLength(5);
    expect(mocks.mirrorRecord).toHaveBeenCalledTimes(5);
    expect(mocks.mirrorRecord.mock.calls.every(([, , managedBy]) => managedBy === "service:svc-1")).toBe(true);
    expect(mocks.syncZoneMirror).toHaveBeenCalledWith("dom-1");

    // A retry of the job (pg-boss) writes nothing new.
    const writes = fake.writes().length;
    await runServiceDnsSetup("svc-1");
    expect(fake.writes()).toHaveLength(writes);
  });

  it("points a VDS hostname under the customer's domain at the server IP", async () => {
    mocks.provider = "cloudflare";
    const vds = { ...hostingService, id: "svc-2", domain: null, serverName: "vds1.ornek.com.tr", ipAddress: "203.0.113.10", product: { category: { slug: "vds" } } };
    const { fake } = setup(vds);
    expect(await runServiceDnsSetup("svc-2")).toMatchObject({ status: "done", written: 1 });
    expect(fake.records.map((r) => `${r.type} ${r.name} ${r.content}`)).toEqual(["A vds1.ornek.com.tr 203.0.113.10"]);
  });

  it("skips a VDS without IP and throws (retry) for hosting without a known IP", async () => {
    mocks.provider = "cloudflare";
    setup({ ...hostingService, serverName: "vds1.ornek.com.tr", product: { category: { slug: "vds" } } });
    expect(await runServiceDnsSetup("svc-1")).toEqual({ status: "skipped", reason: "NO_SERVER_IP" });

    setup();
    await expect(runServiceDnsSetup("svc-1")).rejects.toThrow("DNS_HOSTING_IP_UNKNOWN");
  });

  it("throws when Cloudflare refuses the zone so the job retries", async () => {
    mocks.provider = "cloudflare";
    mocks.settings.set("dns_hosting_ip", "192.0.2.10");
    setup();
    mocks.ensureDomainZone.mockResolvedValue({ ok: false, error: "Bu alan adı başka bir Cloudflare hesabında zaten ekli." });
    await expect(runServiceDnsSetup("svc-1")).rejects.toThrow("DNS_ZONE_FAILED");
  });

  it("ignores services that are no longer active", async () => {
    setup({ ...hostingService, status: "SUSPENDED" });
    expect(await runServiceDnsSetup("svc-1")).toEqual({ status: "skipped", reason: "SERVICE_SUSPENDED" });
  });
});
