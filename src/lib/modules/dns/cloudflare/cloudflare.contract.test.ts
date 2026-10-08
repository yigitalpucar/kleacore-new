process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFetchMock,
  describeDnsModuleBehaviour,
  describeModuleContract,
  makeTestInstance,
  restoreFetch,
} from "../../testing";
import { cloudflareModule, createCloudflareModule, type CloudflareModuleConfig } from ".";
import { cloudflareUserMessage, retryAfterMs } from "./client";
import { canonicalContent, fromCloudflareRecord, toCloudflareBody, unquoteTxt } from "./records";
import { createFakeCloudflare } from "./__fixtures__/fake-api";
import zonesByName from "./__fixtures__/zones-by-name.json";
import recordsPage1 from "./__fixtures__/dns-records-page1.json";
import recordsPage2 from "./__fixtures__/dns-records-page2.json";
import tokenVerify from "./__fixtures__/token-verify.json";
import recordNotFound from "./__fixtures__/error-record-not-found.json";
import invalidAuth from "./__fixtures__/error-invalid-auth.json";

const ACCOUNT = "6eaa8900000000000000000000000000";
const config = {
  apiToken: "cf-test-token-1234567890",
  accountId: ACCOUNT,
  defaultProxied: false,
  defaultTtl: 1,
  displayNameservers: [],
};
const API = "https://api.cloudflare.com/client/v4";
const ZONE_ID = zonesByName.result[0].id;

function makeModule(overrides: Partial<CloudflareModuleConfig> = {}, sleep = vi.fn(async (_ms: number) => {})) {
  const instance = makeTestInstance<CloudflareModuleConfig>(cloudflareModule, { ...config, ...overrides });
  return { dns: createCloudflareModule(instance, { sleep }), sleep };
}

describeModuleContract(cloudflareModule, { config });

describeDnsModuleBehaviour("cloudflare (fake API)", () => {
  createFakeCloudflare({ accountId: ACCOUNT });
  return makeModule().dns;
});

describe("cloudflare module", () => {
  afterEach(() => restoreFetch());

  it("rejects a malformed account id", () => {
    expect(cloudflareModule.configSchema.safeParse({ ...config, accountId: "abc" }).success).toBe(false);
  });

  it("health check verifies the token with the bearer header", async () => {
    const { calls } = createFetchMock([{ method: "GET", url: `${API}/user/tokens/verify`, json: tokenVerify }]);
    const health = await cloudflareModule.healthCheck(makeTestInstance(cloudflareModule, config));
    expect(health).toEqual({ ok: true, message: "Cloudflare API token geçerli ve etkin." });
    expect(calls[0].headers.get("authorization")).toBe(`Bearer ${config.apiToken}`);
  });

  it("health check maps an invalid token to a Turkish message without leaking it", async () => {
    createFetchMock([{ url: `${API}/user/tokens/verify`, status: 400, json: invalidAuth }]);
    const health = await cloudflareModule.healthCheck(makeTestInstance(cloudflareModule, config));
    expect(health.ok).toBe(false);
    expect(health.message).toBe("Cloudflare API token geçersiz.");
    expect(health.message).not.toContain(config.apiToken);
  });

  it("finds an existing zone in the account and returns the assigned nameservers", async () => {
    const { calls } = createFetchMock([{ method: "GET", url: `${API}/zones*`, json: zonesByName }]);
    const result = await makeModule().dns.ensureZone("Ornek.com.tr.");
    expect(result).toMatchObject({
      ok: true,
      data: { zoneId: ZONE_ID, created: false, status: "active", nameservers: ["isaac.ns.cloudflare.com", "luciane.ns.cloudflare.com"] },
    });
    const url = new URL(calls[0].url);
    expect(url.searchParams.get("name")).toBe("ornek.com.tr");
    expect(url.searchParams.get("account.id")).toBe(ACCOUNT);
  });

  it("shows the configured vanity nameservers instead of the assigned ones", async () => {
    createFetchMock([{ method: "GET", url: `${API}/zones*`, json: zonesByName }]);
    const result = await makeModule({ displayNameservers: ["ns1.kleacore.com", "ns2.kleacore.com"] }).dns.ensureZone("ornek.com.tr");
    expect(result.data?.nameservers).toEqual(["ns1.kleacore.com", "ns2.kleacore.com"]);
  });

  it("creates a missing zone in the configured account (full setup, jump start)", async () => {
    const fake = createFakeCloudflare({ accountId: ACCOUNT });
    const result = await makeModule().dns.ensureZone("yeni-alan.com.tr");
    expect(result).toMatchObject({ ok: true, data: { created: true, status: "pending" } });
    const post = fake.writes()[0];
    expect(post).toMatchObject({ method: "POST", path: "/zones" });
    expect(post.body).toEqual({ name: "yeni-alan.com.tr", account: { id: ACCOUNT }, type: "full", jump_start: true });
  });

  it("maps 'zone exists in another account' (1061) to a Turkish error", async () => {
    createFakeCloudflare({ accountId: ACCOUNT, foreignZones: ["baskasinin.com"] });
    const result = await makeModule().dns.ensureZone("baskasinin.com");
    expect(result).toMatchObject({
      ok: false,
      error: "Bu alan adı başka bir Cloudflare hesabında zaten ekli. Önce oradan kaldırılmalı.",
      reference: "cf:1061",
    });
  });

  it("lists every page of records and maps TXT/SRV, skipping unsupported types", async () => {
    const { calls } = createFetchMock([
      { method: "GET", url: `${API}/zones?name=ornek.com.tr&account.id=${ACCOUNT}&per_page=5`, json: zonesByName },
      { method: "GET", url: new RegExp(`/zones/${ZONE_ID}/dns_records\\?page=1&`), json: recordsPage1 },
      { method: "GET", url: new RegExp(`/zones/${ZONE_ID}/dns_records\\?page=2&`), json: recordsPage2 },
    ]);
    const result = await makeModule().dns.listRecords("ornek.com.tr");
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(3);
    expect(result.data?.map((r) => r.type)).toEqual(["A", "A", "MX", "TXT", "SRV"]);
    expect(result.data?.find((r) => r.type === "TXT")?.content).toBe("v=spf1 +mx +a +ip4:192.0.2.10 ~all");
    expect(result.data?.find((r) => r.type === "SRV")).toMatchObject({ name: "_sip._tcp.ornek.com.tr", content: "5 5060 sip.ornek.com.tr", priority: 10 });
    expect(result.data?.find((r) => r.name === "ornek.com.tr" && r.type === "A")).toMatchObject({ proxied: true, ttl: 1 });
    expect(result.data?.find((r) => r.type === "MX")).toMatchObject({ priority: 10, content: "mail.ornek.com.tr" });
  });

  it("paginates against the fake API (page size 2) and finds every record", async () => {
    const fake = createFakeCloudflare({ accountId: ACCOUNT, pageSize: 2 });
    const zone = fake.addZone("ornek.com.tr");
    for (let i = 1; i <= 5; i++) fake.addRecord(zone.id, { type: "A", name: `h${i}.ornek.com.tr`, content: `192.0.2.${i}`, ttl: 1 });
    const result = await makeModule().dns.listRecords("ornek.com.tr");
    expect(result.data).toHaveLength(5);
    expect(fake.requests.filter((r) => r.path.endsWith("/dns_records"))).toHaveLength(3);
  });

  it("waits Retry-After on 429 and then succeeds", async () => {
    createFakeCloudflare({ accountId: ACCOUNT, rateLimit: { count: 2, retryAfter: "3" } }).addZone("ornek.com.tr");
    const { dns, sleep } = makeModule();
    const result = await dns.ensureZone("ornek.com.tr");
    expect(result.ok).toBe(true);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it("gives up after repeated 429s with a Turkish rate-limit message", async () => {
    createFakeCloudflare({ accountId: ACCOUNT, rateLimit: { count: 10 } }).addZone("ornek.com.tr");
    const { dns, sleep } = makeModule();
    const result = await dns.listRecords("ornek.com.tr");
    expect(result).toMatchObject({ ok: false, error: "Cloudflare istek sınırına ulaşıldı; birkaç dakika sonra tekrar deneyin." });
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000, 4000]);
  });

  it("upsert is idempotent: an identical record causes no write", async () => {
    const fake = createFakeCloudflare({ accountId: ACCOUNT });
    fake.addZone("ornek.com.tr");
    const { dns } = makeModule();
    const record = { type: "TXT" as const, name: "ornek.com.tr", content: "v=spf1 +a +mx ~all", ttl: 1 };
    const first = await dns.upsertRecord("ornek.com.tr", record);
    const writesAfterFirst = fake.writes().length;
    const second = await dns.upsertRecord("ornek.com.tr", record);
    expect(second.data?.id).toBe(first.data?.id);
    expect(fake.writes()).toHaveLength(writesAfterFirst);
    // Stored quoted by Cloudflare, compared unquoted.
    expect(fake.records[0].content).toBe('"v=spf1 +a +mx ~all"');
  });

  it("upsert without ttl keeps the existing ttl and proxied flag", async () => {
    const fake = createFakeCloudflare({ accountId: ACCOUNT });
    const zone = fake.addZone("ornek.com.tr");
    fake.addRecord(zone.id, { type: "A", name: "www.ornek.com.tr", content: "192.0.2.1", ttl: 3600, proxied: false });
    const result = await makeModule({ defaultProxied: true }).dns.upsertRecord("ornek.com.tr", {
      type: "A",
      name: "www.ornek.com.tr",
      content: "192.0.2.1",
    });
    expect(result.data).toMatchObject({ ttl: 3600, proxied: false });
    expect(fake.writes()).toHaveLength(0);
  });

  it("writes MX priority, SRV and CAA data, and forces auto TTL when proxied", () => {
    const defaults = { ttl: 300, proxied: false };
    expect(toCloudflareBody({ type: "MX", name: "Ornek.com.tr.", content: "Mail.Ornek.com.tr.", priority: 5 }, defaults)).toMatchObject({
      name: "ornek.com.tr",
      content: "mail.ornek.com.tr",
      priority: 5,
      ttl: 300,
    });
    expect(toCloudflareBody({ type: "SRV", name: "_sip._tcp.ornek.com.tr", content: "5 5060 sip.ornek.com.tr", priority: 10 }, defaults).data).toEqual({
      priority: 10,
      weight: 5,
      port: 5060,
      target: "sip.ornek.com.tr",
    });
    expect(toCloudflareBody({ type: "CAA", name: "ornek.com.tr", content: '0 issue "letsencrypt.org"' }, defaults).data).toEqual({
      flags: 0,
      tag: "issue",
      value: "letsencrypt.org",
    });
    expect(toCloudflareBody({ type: "A", name: "ornek.com.tr", content: "192.0.2.1", ttl: 3600, proxied: true }, defaults)).toMatchObject({
      ttl: 1,
      proxied: true,
    });
    expect(toCloudflareBody({ type: "TXT", name: "ornek.com.tr", content: "x", ttl: 30 }, defaults).ttl).toBe(60);
  });

  it("round-trips CAA through the fake API and matches it on upsert", async () => {
    const fake = createFakeCloudflare({ accountId: ACCOUNT });
    fake.addZone("ornek.com.tr");
    const { dns } = makeModule();
    const caa = { type: "CAA" as const, name: "ornek.com.tr", content: '0 issue "letsencrypt.org"' };
    const first = await dns.upsertRecord("ornek.com.tr", caa);
    const second = await dns.upsertRecord("ornek.com.tr", caa);
    expect(first.ok).toBe(true);
    expect(second.data?.id).toBe(first.data?.id);
    expect(fake.records).toHaveLength(1);
  });

  it("maps Cloudflare record errors to Turkish messages", async () => {
    const fake = createFakeCloudflare({ accountId: ACCOUNT });
    const zone = fake.addZone("ornek.com.tr");
    fake.addRecord(zone.id, { type: "CNAME", name: "blog.ornek.com.tr", content: "x.example.net", ttl: 1 });
    const result = await makeModule().dns.upsertRecord("ornek.com.tr", { type: "A", name: "blog.ornek.com.tr", content: "192.0.2.1" });
    expect(result).toMatchObject({
      ok: false,
      error: "Bu ad için zaten bir A, AAAA veya CNAME kaydı var; CNAME başka kayıtla aynı adda olamaz.",
      reference: "cf:81053",
    });
  });

  it("updating a record id that no longer exists fails with 'kayıt bulunamadı'", async () => {
    createFetchMock([
      { method: "GET", url: `${API}/zones*`, json: zonesByName },
      { method: "PUT", url: `${API}/zones/${ZONE_ID}/dns_records/missing`, status: 404, json: recordNotFound },
    ]);
    const result = await makeModule().dns.upsertRecord("ornek.com.tr", { id: "missing", type: "A", name: "ornek.com.tr", content: "192.0.2.1" });
    expect(result).toMatchObject({ ok: false, error: "DNS kaydı bulunamadı." });
  });

  it("deleting a missing record (81044) is ok", async () => {
    createFetchMock([
      { method: "GET", url: `${API}/zones*`, json: zonesByName },
      { method: "DELETE", url: `${API}/zones/${ZONE_ID}/dns_records/gone`, status: 404, json: recordNotFound },
    ]);
    expect((await makeModule().dns.deleteRecord("ornek.com.tr", "gone")).ok).toBe(true);
  });

  it("listRecords on a zone that is not in the account fails clearly", async () => {
    createFakeCloudflare({ accountId: ACCOUNT });
    const result = await makeModule().dns.listRecords("yok.com.tr");
    expect(result).toMatchObject({ ok: false, error: "Cloudflare'de bu alan adı için zone yok." });
  });

  it("deleteZone removes the zone and is idempotent", async () => {
    const fake = createFakeCloudflare({ accountId: ACCOUNT });
    fake.addZone("ornek.com.tr");
    const { dns } = makeModule();
    expect((await dns.deleteZone("ornek.com.tr")).ok).toBe(true);
    expect(fake.zones).toHaveLength(0);
    expect((await dns.deleteZone("ornek.com.tr")).ok).toBe(true);
  });
});

describe("cloudflare helpers", () => {
  it("unquotes TXT chunks", () => {
    expect(unquoteTxt('"v=spf1 -all"')).toBe("v=spf1 -all");
    expect(unquoteTxt('"abc" "def"')).toBe("abcdef");
    expect(unquoteTxt('"say \\"hi\\""')).toBe('say "hi"');
    expect(unquoteTxt("plain")).toBe("plain");
  });

  it("canonicalises host-name content", () => {
    expect(canonicalContent("CNAME", "Target.Example.NET.")).toBe("target.example.net");
    expect(canonicalContent("CAA", '0 ISSUE "letsencrypt.org"')).toBe("0 issue letsencrypt.org");
  });

  it("maps record shapes without data", () => {
    expect(fromCloudflareRecord({ id: "1", type: "SRV", name: "_a._tcp.x.com", content: "10 5 80 t.x.com" })).toMatchObject({
      priority: 10,
      content: "5 80 t.x.com",
    });
    expect(fromCloudflareRecord({ id: "2", type: "HTTPS", name: "x.com", content: "1 . alpn=h2" })).toBeNull();
  });

  it("chooses the Retry-After wait", () => {
    expect(retryAfterMs("2", 0)).toBe(2000);
    expect(retryAfterMs(null, 2)).toBe(4000);
  });

  it("maps error codes, chains and statuses", () => {
    expect(cloudflareUserMessage([{ code: 6003, message: "x", error_chain: [{ code: 6111, message: "y" }] }])).toBe(
      "Cloudflare API token geçersiz."
    );
    expect(cloudflareUserMessage([{ code: 1, message: "x", error_chain: [{ code: 9005, message: "y" }] }])).toBe(
      "A kaydının değeri geçerli bir IPv4 adresi olmalı."
    );
    expect(cloudflareUserMessage([{ code: 123456, message: "x" }])).toBe("Cloudflare işlemi başarısız (kod 123456).");
    expect(cloudflareUserMessage([], 403)).toContain("yetkili değil");
    expect(cloudflareUserMessage([], 503)).toContain("geçici");
  });
});
