/**
 * Shared contract-test helpers for modules (vitest only — never import from
 * app code). docs/modules.md → "Sözleşme testleri".
 *
 *   import { describeModuleContract, createFetchMock } from "@/lib/modules/testing";
 *
 *   describeModuleContract(proxmoxModule, {
 *     config: { apiUrl: "https://pve.test:8006", tokenId: "root@pam!kc", tokenSecret: "s3cret", node: "pve" },
 *     productOptions: { templateVmid: 9000, cores: 2, memoryMB: 2048, diskGB: 40 },
 *   });
 *
 * The suite checks the static manifest (ids, schemas, secret fields,
 * capability ↔ method agreement), config encryption round-trip, the
 * generated admin form, and that every contract method and the health check
 * fail *gracefully* (ok: false, no throw) when the remote API is down. Add
 * your own behaviour tests with `createFetchMock` fixtures next to it —
 * no test may reach a real system.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decryptModuleConfig,
  encryptModuleConfig,
  maskModuleConfig,
  MASKED_SECRET_PLACEHOLDER,
  parseStoredModuleConfig,
} from "./config";
import type {
  DnsModule,
  DnsModuleRecord,
  ModuleContracts,
  ServerAccountContext,
} from "./contracts";
import { parseProductOptions, validateManifest } from "./registry";
import { describeSchema, schemaShape } from "./schema-form";
import type { AnyModuleManifest, ModuleKind, ResolvedModuleInstance } from "./types";

// ---------------------------------------------------------------------------
// Instances & contexts
// ---------------------------------------------------------------------------

/** A resolved instance as the registry would build it (config parsed by the schema). */
export function makeTestInstance<TConfig extends Record<string, unknown>>(
  manifest: AnyModuleManifest,
  config: Record<string, unknown>,
  overrides: Partial<ResolvedModuleInstance<TConfig>> = {}
): ResolvedModuleInstance<TConfig> {
  const parsed = manifest.configSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`test config for ${manifest.id} is invalid: ${parsed.error.message}`);
  }
  return {
    id: `test-${manifest.id}`,
    kind: manifest.kind,
    moduleId: manifest.id,
    label: `Test ${manifest.name}`,
    config: parsed.data as TConfig,
    isActive: true,
    priority: 0,
    groupKey: null,
    capacity: null,
    legacySource: null,
    ...overrides,
  };
}

/** A server-module context with sensible defaults. */
export function makeServerContext<TOptions = Record<string, unknown>>(
  instance: Pick<ResolvedModuleInstance, "id" | "label" | "moduleId">,
  options: TOptions,
  service: Partial<ServerAccountContext["service"]> = {}
): ServerAccountContext<TOptions> {
  return {
    instance: { id: instance.id, label: instance.label, moduleId: instance.moduleId },
    service: {
      id: "svc_test_1",
      label: "Test hizmeti",
      domain: "ornek.com.tr",
      username: "ornekcom",
      remoteId: "ornekcom",
      ipAddress: null,
      customer: { id: "usr_test_1", email: "musteri@test.local", name: "Test", surname: "Müşteri" },
      product: { id: "prd_test_1", sku: "HOST-TEST", name: "Test paketi", categorySlug: "hosting" },
      ...service,
    },
    options,
  };
}

// ---------------------------------------------------------------------------
// HTTP fixtures
// ---------------------------------------------------------------------------

export interface FetchRoute {
  method?: string;
  /** Exact URL, URL prefix ending with "*", or RegExp. */
  url: string | RegExp;
  status?: number;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
  /** Inspect the request (throw / expect inside to fail the test). */
  assert?: (request: { url: string; method: string; headers: Headers; body: string | null }) => void;
  /** Answer only once (default: every matching request). */
  once?: boolean;
}

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Headers;
  body: string | null;
}

function matches(route: FetchRoute, url: string, method: string) {
  if (route.method && route.method.toUpperCase() !== method) return false;
  if (route.url instanceof RegExp) return route.url.test(url);
  if (route.url.endsWith("*")) return url.startsWith(route.url.slice(0, -1));
  return url === route.url;
}

/**
 * Replaces global fetch with fixture routes (restored after each test by
 * `restoreFetch()` / vi.unstubAllGlobals). An unmatched request throws, so a
 * module can never reach a real API from a test.
 */
export function createFetchMock(routes: FetchRoute[]) {
  const calls: RecordedRequest[] = [];
  const used = new Set<FetchRoute>();

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const body = typeof init?.body === "string" ? init.body : init?.body ? String(init.body) : null;
    const request = { url, method, headers, body };
    calls.push(request);

    const route = routes.find((candidate) => matches(candidate, url, method) && !(candidate.once && used.has(candidate)));
    if (!route) throw new Error(`Unexpected request in test: ${method} ${url}`);
    used.add(route);
    route.assert?.(request);

    const payload = route.json !== undefined ? JSON.stringify(route.json) : (route.text ?? "");
    return new Response(payload, {
      status: route.status ?? 200,
      headers: { "content-type": route.json !== undefined ? "application/json" : "text/plain", ...route.headers },
    });
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetch: fetchMock, calls };
}

/** Every request fails like a dead host (connection refused). */
export function createUnreachableFetch() {
  const fetchMock = vi.fn(async () => {
    throw new TypeError("fetch failed (ECONNREFUSED, test)");
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function restoreFetch() {
  vi.unstubAllGlobals();
}

// ---------------------------------------------------------------------------
// Static assertions
// ---------------------------------------------------------------------------

/** Optional contract methods and the capability that must declare them. */
const OPTIONAL_METHOD_CAPABILITIES: Partial<Record<ModuleKind, Record<string, string>>> = {
  server: {
    getUsage: "usage",
    getSsoUrl: "sso",
    getConsoleUrl: "console",
    powerAction: "power",
    reinstall: "reinstall",
    listAccounts: "listAccounts",
  },
  registrar: {
    checkDomainsAvailability: "bulkAvailability",
    fetchTldPricing: "tldPricing",
    listDomains: "listDomains",
    getEppCode: "eppCode",
    setLock: "lock",
  },
  dns: {
    deleteZone: "deleteZone",
  },
};

const REQUIRED_METHODS: Partial<Record<ModuleKind, string[]>> = {
  server: ["createAccount", "suspend", "unsuspend", "terminate", "changePackage"],
  registrar: [
    "registerDomain",
    "renewDomain",
    "getDomainInfo",
    "updateNameservers",
    "updateDnsRecords",
    "transferDomain",
    "checkDomainAvailability",
    "healthCheck",
  ],
  dns: ["ensureZone", "listRecords", "upsertRecord", "deleteRecord"],
};

/** Throws when declared capabilities and implemented methods disagree. */
export function assertModuleContract(manifest: AnyModuleManifest, contract: unknown) {
  const object = contract as Record<string, unknown>;
  const problems: string[] = [];

  for (const method of REQUIRED_METHODS[manifest.kind] ?? []) {
    if (typeof object[method] !== "function") problems.push(`missing required method ${method}()`);
  }
  for (const [method, capability] of Object.entries(OPTIONAL_METHOD_CAPABILITIES[manifest.kind] ?? {})) {
    const declared = (manifest.capabilities as readonly string[]).includes(capability);
    const implemented = typeof object[method] === "function";
    if (declared && !implemented) problems.push(`capability "${capability}" declared but ${method}() missing`);
    if (!declared && implemented) problems.push(`${method}() implemented but capability "${capability}" not declared`);
  }

  if (problems.length) throw new Error(`module "${manifest.id}" contract:\n- ${problems.join("\n- ")}`);
}

/** Encrypt → store → decrypt → parse returns the same config; secrets never stored or shown in clear. */
export function assertConfigRoundTrip(manifest: AnyModuleManifest, config: Record<string, unknown>) {
  const parsed = manifest.configSchema.parse(config) as Record<string, unknown>;
  const stored = encryptModuleConfig(manifest, parsed);
  const storedJson = JSON.stringify(stored);

  for (const field of manifest.secretFields) {
    const value = parsed[field];
    if (typeof value === "string" && value) {
      expect(String(stored[field])).toMatch(/^enc:v1:/);
      // Short sample values could appear inside base64 by chance; use realistic test secrets.
      if (value.length >= 8) expect(storedJson).not.toContain(value);
    }
  }
  expect(parseStoredModuleConfig(manifest, JSON.parse(storedJson))).toEqual(parsed);
  expect(decryptModuleConfig(manifest, stored)).toEqual(parsed);

  const masked = maskModuleConfig(manifest, stored);
  for (const field of manifest.secretFields) {
    expect(masked[field]).toBe(parsed[field] ? MASKED_SECRET_PLACEHOLDER : "");
  }
}

// ---------------------------------------------------------------------------
// The suite
// ---------------------------------------------------------------------------

export interface ModuleContractOptions {
  /** A valid instance config (fake credentials, test hostnames). */
  config: Record<string, unknown>;
  /** Server modules: valid Product.moduleOptions. */
  productOptions?: Record<string, unknown>;
  /** Server modules: options that must be rejected (e.g. missing template). */
  invalidProductOptions?: Record<string, unknown>;
  /** Skip the "fails gracefully when the API is down" checks (e.g. SDK-based modules). */
  skipUnreachable?: boolean;
}

async function expectGracefulFailure(label: string, call: () => Promise<{ ok: boolean } | unknown>) {
  let result: unknown;
  try {
    result = await call();
  } catch (error) {
    throw new Error(`${label} threw instead of returning { ok: false }: ${error instanceof Error ? error.message : error}`);
  }
  expect(result, label).toMatchObject({ ok: false });
}

/**
 * Registers the shared contract suite for one manifest. Call at the top
 * level of `<module>.contract.test.ts`.
 */
export function describeModuleContract(manifest: AnyModuleManifest, options: ModuleContractOptions) {
  describe(`module contract: ${manifest.id}`, () => {
    afterEach(() => restoreFetch());

    it("has a valid manifest", () => {
      expect(validateManifest(manifest)).toEqual([]);
    });

    it("accepts the sample config and round-trips it encrypted", () => {
      assertConfigRoundTrip(manifest, options.config);
    });

    it("rejects an empty config when it has required fields", () => {
      const shape = schemaShape(manifest.configSchema) ?? {};
      const hasRequired = Object.values(shape).some((field) => !field.isOptional());
      expect(manifest.configSchema.safeParse({}).success).toBe(!hasRequired);
    });

    it("describes its admin form", () => {
      const fields = describeSchema(manifest.configSchema, manifest.configFields, manifest.secretFields);
      expect(fields.map((field) => field.name).sort()).toEqual(Object.keys(schemaShape(manifest.configSchema) ?? {}).sort());
      for (const secret of manifest.secretFields) {
        expect(fields.find((field) => field.name === secret)?.type).toBe("secret");
      }
    });

    if (manifest.kind === "server") {
      it("validates product options", () => {
        expect(parseProductOptions(manifest, options.productOptions ?? {}).success).toBe(true);
        if (options.invalidProductOptions) {
          expect(parseProductOptions(manifest, options.invalidProductOptions).success).toBe(false);
        }
      });
    }

    if (manifest.create) {
      it("implements exactly the declared capabilities", () => {
        const contract = manifest.create!(makeTestInstance(manifest, options.config));
        assertModuleContract(manifest, contract);
      });
    }

    if (!options.skipUnreachable) {
      it("health check reports ok: false (no throw) when the API is unreachable", async () => {
        createUnreachableFetch();
        const health = await manifest.healthCheck(makeTestInstance(manifest, options.config));
        expect(health.ok).toBe(false);
        expect(typeof health.message).toBe("string");
      });

      if (manifest.create && manifest.kind === "server") {
        it("every server operation fails gracefully when the API is unreachable", async () => {
          createUnreachableFetch();
          const instance = makeTestInstance(manifest, options.config);
          const subject = manifest.create!(instance) as ModuleContracts["server"];
          const parsed = parseProductOptions(manifest, options.productOptions ?? {});
          const ctx = makeServerContext(instance, parsed.success ? parsed.data : {});
          await expectGracefulFailure("createAccount", () => subject.createAccount(ctx));
          await expectGracefulFailure("suspend", () => subject.suspend(ctx, "test"));
          await expectGracefulFailure("unsuspend", () => subject.unsuspend(ctx));
          await expectGracefulFailure("terminate", () => subject.terminate(ctx));
          await expectGracefulFailure("changePackage", () => subject.changePackage(ctx));
          if (subject.getUsage) await expectGracefulFailure("getUsage", () => subject.getUsage!(ctx));
          if (subject.getSsoUrl) await expectGracefulFailure("getSsoUrl", () => subject.getSsoUrl!(ctx));
          if (subject.getConsoleUrl) await expectGracefulFailure("getConsoleUrl", () => subject.getConsoleUrl!(ctx));
          if (subject.powerAction) await expectGracefulFailure("powerAction", () => subject.powerAction!(ctx, "restart"));
          if (subject.reinstall) await expectGracefulFailure("reinstall", () => subject.reinstall!(ctx, {}));
          if (subject.listAccounts) await expectGracefulFailure("listAccounts", () => subject.listAccounts!());
        });
      }

      if (manifest.create && manifest.kind === "dns") {
        it("every DNS operation fails gracefully when the API is unreachable", async () => {
          createUnreachableFetch();
          const subject = manifest.create!(makeTestInstance(manifest, options.config)) as DnsModule;
          await expectGracefulFailure("ensureZone", () => subject.ensureZone("ornek.com.tr"));
          await expectGracefulFailure("listRecords", () => subject.listRecords("ornek.com.tr"));
          await expectGracefulFailure("upsertRecord", () =>
            subject.upsertRecord("ornek.com.tr", { type: "A", name: "ornek.com.tr", content: "192.0.2.10" })
          );
          await expectGracefulFailure("deleteRecord", () => subject.deleteRecord("ornek.com.tr", "rec_1"));
          if (subject.deleteZone) await expectGracefulFailure("deleteZone", () => subject.deleteZone!("ornek.com.tr"));
        });
      }

      if (manifest.create && manifest.kind === "registrar") {
        it("registrar lookups fail gracefully when the API is unreachable", async () => {
          createUnreachableFetch();
          const subject = manifest.create!(makeTestInstance(manifest, options.config)) as ModuleContracts["registrar"];
          await expectGracefulFailure("getDomainInfo", () => subject.getDomainInfo("ornek.com.tr"));
          await expectGracefulFailure("checkDomainAvailability", () => subject.checkDomainAvailability("ornek.com.tr"));
          await expectGracefulFailure("healthCheck", () => subject.healthCheck());
          if (subject.listDomains) await expectGracefulFailure("listDomains", () => subject.listDomains!());
        });
      }
    }
  });
}

/**
 * Behaviour suite for DnsModule semantics (idempotent ensureZone, upsert
 * matching rules, idempotent delete). Pass a factory returning a module over
 * a *stateful* fake backend (in-memory, or a fetch mock that keeps records).
 */
export function describeDnsModuleBehaviour(name: string, createModule: () => DnsModule) {
  describe(`dns behaviour: ${name}`, () => {
    const zone = "ornek.com.tr";

    it("ensureZone is idempotent and returns nameservers", async () => {
      const dns = createModule();
      const first = await dns.ensureZone(zone);
      const second = await dns.ensureZone(zone);
      expect(first).toMatchObject({ ok: true, data: { created: true } });
      expect(second).toMatchObject({ ok: true, data: { created: false, zoneId: first.data?.zoneId } });
      expect(second.data?.nameservers.length).toBeGreaterThan(0);
    });

    it("upsert without id creates once, then updates TTL in place", async () => {
      const dns = createModule();
      await dns.ensureZone(zone);
      const record: DnsModuleRecord = { type: "A", name: `www.${zone}`, content: "192.0.2.10", ttl: 300 };
      const created = await dns.upsertRecord(zone, record);
      const updated = await dns.upsertRecord(zone, { ...record, ttl: 600 });
      expect(updated.data?.id).toBe(created.data?.id);
      const list = await dns.listRecords(zone);
      const matching = list.data?.filter((r) => r.type === "A" && r.name === `www.${zone}`) ?? [];
      expect(matching).toHaveLength(1);
      expect(matching[0].ttl).toBe(600);
    });

    it("multi-value types keep one record per content; CNAME replaces", async () => {
      const dns = createModule();
      await dns.ensureZone(zone);
      await dns.upsertRecord(zone, { type: "TXT", name: zone, content: "v=spf1 -all" });
      await dns.upsertRecord(zone, { type: "TXT", name: zone, content: "google-site-verification=x" });
      await dns.upsertRecord(zone, { type: "CNAME", name: `blog.${zone}`, content: "a.example.net" });
      await dns.upsertRecord(zone, { type: "CNAME", name: `blog.${zone}`, content: "b.example.net" });
      const list = (await dns.listRecords(zone)).data ?? [];
      expect(list.filter((r) => r.type === "TXT" && r.name === zone)).toHaveLength(2);
      const cnames = list.filter((r) => r.type === "CNAME" && r.name === `blog.${zone}`);
      expect(cnames).toHaveLength(1);
      expect(cnames[0].content).toBe("b.example.net");
    });

    it("deleteRecord is idempotent", async () => {
      const dns = createModule();
      await dns.ensureZone(zone);
      const created = await dns.upsertRecord(zone, { type: "A", name: zone, content: "192.0.2.20" });
      expect((await dns.deleteRecord(zone, created.data!.id)).ok).toBe(true);
      expect((await dns.deleteRecord(zone, created.data!.id)).ok).toBe(true);
      expect((await dns.listRecords(zone)).data?.some((r) => r.id === created.data!.id)).toBe(false);
    });
  });
}
