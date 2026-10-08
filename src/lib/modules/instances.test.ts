/**
 * Instance resolution (product → instance, least-loaded pools) and
 * provisioning routing: bound services go through the module, unbound ones
 * keep the legacy Settings-backed provider.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

type InstanceRow = {
  id: string;
  kind: string;
  moduleId: string;
  label: string;
  config: unknown;
  isActive: boolean;
  priority: number;
  groupKey: string | null;
  capacity: number | null;
  legacySource: string | null;
  createdAt: Date;
};

const state = vi.hoisted(() => ({
  instances: [] as InstanceRow[],
  loads: new Map<string, number>(),
  settings: new Map<string, string>(),
  serviceUpdates: [] as unknown[],
  releaseIp: vi.fn(async () => ["192.0.2.10"]),
  patchState: vi.fn(async () => undefined),
}));

function matchesWhere(row: InstanceRow, where: Record<string, unknown>) {
  return Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
}

vi.mock("@/lib/db", () => ({
  db: {
    moduleInstance: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => state.instances.find((row) => row.id === where.id) ?? null),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => state.instances.filter((row) => matchesWhere(row, where))),
      update: vi.fn(async () => ({})),
    },
    service: {
      groupBy: vi.fn(async ({ where }: { where: { moduleInstanceId: { in: string[] } } }) =>
        where.moduleInstanceId.in
          .filter((id) => state.loads.has(id))
          .map((id) => ({ moduleInstanceId: id, _count: { _all: state.loads.get(id)! } }))
      ),
      update: vi.fn(async (args: unknown) => {
        state.serviceUpdates.push(args);
        return {};
      }),
    },
  },
}));
vi.mock("@/lib/integrations/settings", () => ({
  isEnabled: (value: string | undefined | null) => ["1", "true", "yes", "on", "active"].includes((value ?? "").toLowerCase()),
  getSettingMap: async (keys: Array<{ key: string; fallback?: string }>) =>
    Object.fromEntries(keys.map((item) => [item.key, state.settings.get(item.key) || item.fallback || ""])),
}));
vi.mock("@/lib/ipam", () => ({ releaseIp: state.releaseIp }));
vi.mock("./service-state", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./service-state")>()),
  patchServiceModuleState: state.patchState,
}));

import type { ServiceWithProduct } from "@/lib/integrations/provisioning/types";
import { getProvisioningProviderForService } from "@/lib/integrations/provisioning";
import { encryptModuleConfig } from "./config";
import { resolveInstanceForProduct } from "./instances";
import { planProductProvisioning } from "./provisioning";
import { cpanelWhmModule } from "./server/cpanel-whm";
import { createFetchMock, restoreFetch } from "./testing";

let seq = 0;
function addWhm(overrides: Partial<InstanceRow> = {}) {
  const row: InstanceRow = {
    id: `mi-${++seq}`,
    kind: "server",
    moduleId: "cpanel-whm",
    label: `WHM ${seq}`,
    config: encryptModuleConfig(cpanelWhmModule, { host: `whm${seq}.test`, port: 2087, username: "kc", apiToken: "TOKEN-123456", useSsl: true, defaultPlan: "default" }),
    isActive: true,
    priority: 0,
    groupKey: null,
    capacity: null,
    legacySource: null,
    createdAt: new Date(2026, 0, seq),
    ...overrides,
  };
  state.instances.push(row);
  return row;
}

function service(overrides: Partial<ServiceWithProduct> = {}): ServiceWithProduct {
  return {
    id: "svc-1",
    customerId: "cus-1",
    productId: "prd-1",
    label: "Hosting",
    domain: "ornek.com.tr",
    username: "ornekcom",
    ipAddress: null,
    serverName: null,
    moduleInstanceId: null,
    remoteId: null,
    product: {
      id: "prd-1",
      sku: "HOST-1",
      name: "Hosting",
      moduleInstanceId: null,
      moduleOptions: {},
      category: { slug: "hosting" },
    },
    customer: { id: "cus-1", name: "Ayşe", surname: "Yılmaz", email: "a@example.com" },
    ...overrides,
  } as unknown as ServiceWithProduct;
}

beforeEach(() => {
  state.instances = [];
  state.loads = new Map();
  state.serviceUpdates = [];
  state.releaseIp.mockClear();
  state.settings = new Map([
    ["cpanel_enabled", "true"],
    ["cpanel_host", "legacy-whm.test"],
    ["cpanel_username", "kleacore"],
    ["cpanel_api_token", "LEGACY-TOKEN"],
  ]);
  seq = 0;
});
afterEach(() => restoreFetch());

describe("resolveInstanceForProduct", () => {
  it("returns null for unbound products and missing/inactive instances", async () => {
    const inactive = addWhm({ isActive: false });
    expect(await resolveInstanceForProduct({ moduleInstanceId: null })).toBeNull();
    expect(await resolveInstanceForProduct({ moduleInstanceId: "missing" })).toBeNull();
    expect(await resolveInstanceForProduct({ moduleInstanceId: inactive.id })).toBeNull();
    expect(await planProductProvisioning({ moduleInstanceId: inactive.id })).toEqual({
      mode: "manual",
      reason: "MODULE_INSTANCE_UNAVAILABLE",
    });
    expect(await planProductProvisioning({ moduleInstanceId: null })).toEqual({ mode: "legacy" });
  });

  it("returns the bound instance with its config decrypted", async () => {
    const whm = addWhm();
    const resolved = await resolveInstanceForProduct({ moduleInstanceId: whm.id });
    expect(resolved).toMatchObject({ id: whm.id, moduleId: "cpanel-whm", config: { host: "whm1.test", apiToken: "TOKEN-123456" } });
  });

  it("picks the least loaded active member of the bound instance's group", async () => {
    const a = addWhm({ groupKey: "tr" });
    const b = addWhm({ groupKey: "tr" });
    addWhm({ groupKey: "tr", isActive: false });
    addWhm({ groupKey: "other" });
    state.loads.set(a.id, 40);
    state.loads.set(b.id, 12);

    expect((await resolveInstanceForProduct({ moduleInstanceId: a.id }))?.id).toBe(b.id);
  });

  it("compares load against capacity, skips full servers and breaks ties by priority", async () => {
    const big = addWhm({ groupKey: "tr", capacity: 400, priority: 5 });
    const small = addWhm({ groupKey: "tr", capacity: 50 });
    state.loads.set(big.id, 100); // 25 %
    state.loads.set(small.id, 25); // 50 %
    expect((await resolveInstanceForProduct({ moduleInstanceId: small.id }))?.id).toBe(big.id);

    state.loads.set(big.id, 400); // full
    expect((await resolveInstanceForProduct({ moduleInstanceId: small.id }))?.id).toBe(small.id);

    state.loads.set(small.id, 50); // both full
    expect(await resolveInstanceForProduct({ moduleInstanceId: small.id })).toBeNull();

    const tieA = addWhm({ groupKey: "eq", priority: 2 });
    const tieB = addWhm({ groupKey: "eq", priority: 1 });
    expect((await resolveInstanceForProduct({ moduleInstanceId: tieA.id }))?.id).toBe(tieB.id);
  });
});

describe("getProvisioningProviderForService routing", () => {
  it("keeps unbound services on the legacy Settings-backed provider", async () => {
    const { calls } = createFetchMock([{ url: "https://legacy-whm.test:2087/json-api/*", json: { metadata: { result: 1 } } }]);
    const provider = await getProvisioningProviderForService(service());

    expect(provider.name).toBe("cpanel-whm");
    await provider.suspendService(service(), "test");
    expect(calls[0].url).toMatch(/^https:\/\/legacy-whm\.test:2087\/json-api\/suspendacct/);
    expect(state.serviceUpdates).toHaveLength(0);
  });

  it("routes bound services to their instance and records the remote id on creation", async () => {
    const whm = addWhm();
    const { calls } = createFetchMock([{ url: "https://whm1.test:2087/json-api/*", json: { metadata: { result: 1 } } }]);
    const bound = service({
      moduleInstanceId: whm.id,
      product: { id: "prd-1", sku: "HOST-1", name: "Hosting", moduleInstanceId: whm.id, moduleOptions: { package: "kc_pro" }, category: { slug: "hosting" } },
    } as never);

    const provider = await getProvisioningProviderForService(bound);
    const result = await provider.createService(bound);

    expect(result).toMatchObject({ ok: true, provider: "cpanel-whm", reference: "ornekcom" });
    expect(new URL(calls[0].url).searchParams.get("plan")).toBe("kc_pro");
    expect(state.serviceUpdates[0]).toEqual({
      where: { id: "svc-1" },
      data: { moduleInstanceId: whm.id, remoteId: "ornekcom" },
    });
  });

  it("uses the service's own instance for later operations and releases IPs on terminate", async () => {
    const whm = addWhm({ isActive: false }); // deactivated: existing accounts are still managed
    createFetchMock([{ url: "https://whm1.test:2087/json-api/*", json: { metadata: { result: 1 } } }]);
    const bound = service({ moduleInstanceId: whm.id, remoteId: "acct9" } as never);

    const provider = await getProvisioningProviderForService(bound);
    expect(await provider.terminateService(bound)).toMatchObject({ ok: true, reference: "acct9" });
    expect(state.releaseIp).toHaveBeenCalledWith("svc-1");
    // The username / VMID may be reused remotely: detached (unique per instance), kept as history.
    expect(state.patchState).toHaveBeenCalledWith("svc-1", "bridge", expect.objectContaining({ terminatedRemoteId: "acct9" }));
    expect(state.serviceUpdates).toContainEqual({ where: { id: "svc-1" }, data: { remoteId: null } });
  });

  it("fails (never skips) when the bound instance is gone or its options are invalid", async () => {
    const gone = await getProvisioningProviderForService(service({ moduleInstanceId: "deleted" } as never));
    const result = await gone.createService(service());
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/MODULE_INSTANCE_NOT_FOUND/) });
    expect(result.skipped).toBeUndefined();

    const whm = addWhm();
    const badOptions = service({
      moduleInstanceId: whm.id,
      product: { id: "p", sku: "S", name: "n", moduleInstanceId: whm.id, moduleOptions: { package: 5 }, category: { slug: "hosting" } },
    } as never);
    const provider = await getProvisioningProviderForService(badOptions);
    expect(await provider.createService(badOptions)).toMatchObject({ ok: false, error: expect.stringMatching(/^MODULE_OPTIONS_INVALID/) });
  });

  it("refuses a plan change onto a product bound to a different module type", async () => {
    const whm = addWhm();
    addWhm({ id: "mi-pve", moduleId: "virtualizor", config: {} });
    const moving = service({
      moduleInstanceId: whm.id,
      remoteId: "acct1",
      product: { id: "p2", sku: "VDS", name: "VDS", moduleInstanceId: "mi-pve", moduleOptions: {}, category: { slug: "vds" } },
    } as never);
    const provider = await getProvisioningProviderForService(moving);
    expect(await provider.changeServicePlan(moving, "VDS")).toMatchObject({ ok: false, error: "MODULE_MISMATCH: cpanel-whm → virtualizor" });
  });
});
