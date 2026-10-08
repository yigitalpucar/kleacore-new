/**
 * Legacy Settings → ModuleInstance migration. The real config readers
 * (getCpanelWhmConfig, getRegistrarConfig, getVpsVdsConfig,
 * getPaymentGatewayConfig) run against an in-memory Setting table, so the
 * "before/after" comparisons below exercise the production code paths.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

type Row = Record<string, unknown> & { id: string; legacySource: string | null; config: unknown };

const state = vi.hoisted(() => ({
  settings: new Map<string, string>(),
  instances: [] as Array<Record<string, unknown> & { id: string; legacySource: string | null; config: unknown }>,
  serverUpdates: [] as unknown[],
}));

vi.mock("@/lib/integrations/settings", async () => {
  const { resolveSettingValue } = await import("@/lib/secrets/crypto");
  return {
    isEnabled: (value: string | undefined | null) => ["1", "true", "yes", "on", "active"].includes((value ?? "").toLowerCase()),
    getSettingMap: async (keys: Array<{ key: string; env?: string; fallback?: string }>) =>
      Object.fromEntries(
        keys.map((item) => [item.key, resolveSettingValue(item.key, state.settings.get(item.key) || item.fallback || "")])
      ),
    getSettingValue: async (key: string, _env?: string, fallback = "") => state.settings.get(key) ?? fallback,
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    moduleInstance: {
      findUnique: vi.fn(async ({ where }: { where: { legacySource?: string; id?: string } }) =>
        state.instances.find((row) => (where.id ? row.id === where.id : row.legacySource === where.legacySource)) ?? null
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `mi-${state.instances.length + 1}`, ...data } as Row;
        state.instances.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = state.instances.find((item) => item.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    server: {
      updateMany: vi.fn(async (args: unknown) => {
        state.serverUpdates.push(args);
        return { count: 1 };
      }),
    },
  },
}));

import { getPaymentGatewayConfig } from "@/lib/integrations/payment-gateways/config";
import { getCpanelWhmConfig, getVpsVdsConfig } from "@/lib/integrations/provisioning/config";
import { getRegistrarConfig } from "@/lib/integrations/registrar/config";
import { encryptSecret } from "@/lib/secrets/crypto";
import { parseStoredModuleConfig } from "./config";
import {
  legacyCpanelConfigFromInstance,
  legacyGriConfigFromInstance,
  legacyVirtualizorConfigFromInstance,
  syncLegacyModuleInstances,
  verifyLegacyModuleInstances,
} from "./legacy";
import { cpanelWhmModule, toCpanelWhmClientConfig, type CpanelWhmModuleConfig } from "./server/cpanel-whm";
import { griModule, type GriModuleConfig } from "./registrar/gri";
import { virtualizorModule, type VirtualizorModuleConfig } from "./server/virtualizor";

function seedProductionLikeSettings() {
  state.settings = new Map([
    ["cpanel_enabled", "true"],
    ["cpanel_host", "188.132.235.10"],
    ["cpanel_port", "2087"],
    ["cpanel_username", "kleacore"],
    // Secret settings are stored encrypted in production.
    ["cpanel_api_token", encryptSecret("WHM-API-TOKEN-XYZ")],
    ["cpanel_default_plan", "kleacore_default"],
    ["cpanel_use_ssl", "true"],
    ["registrar_enabled", "true"],
    ["registrar_provider", "gri"],
    ["registrar_username", "gri-user"],
    ["registrar_password", encryptSecret("gri-password-123")],
    ["registrar_client_id", "gri-client"],
    ["registrar_client_secret", encryptSecret("gri-client-secret-456")],
    ["registrar_test_mode", "false"],
    ["vps_vds_enabled", "true"],
    ["vps_vds_provider", "virtualizor"],
    ["vps_vds_api_url", "https://virt.test:4085"],
    ["vps_vds_api_key", "virt-key-123"],
    ["vps_vds_api_password", encryptSecret("virt-pass-456")],
    ["payment_methods", JSON.stringify({ order: ["kuveytturk", "bank_transfer"], enabled: ["kuveytturk", "bank_transfer"], defaultMethod: "kuveytturk" })],
    ["kuveytturk_enabled", "true"],
    ["kuveytturk_merchant_id", "57902"],
    ["kuveytturk_customer_id", "97228291"],
    ["kuveytturk_username", "apitest"],
    ["kuveytturk_password", encryptSecret("api123")],
  ]);
}

describe("legacy Settings → ModuleInstance migration", () => {
  beforeEach(() => {
    state.instances = [];
    state.serverUpdates = [];
    seedProductionLikeSettings();
  });

  it("creates one encrypted mirror per configured legacy source and links the WHM server row", async () => {
    const reports = await syncLegacyModuleInstances();

    expect(reports.map((r) => [r.source, r.action])).toEqual([
      ["cpanel", "created"],
      ["registrar", "created"],
      ["vps_vds", "created"],
    ]);
    const whm = state.instances.find((row) => row.legacySource === "cpanel")!;
    expect(whm).toMatchObject({ kind: "server", moduleId: "cpanel-whm", label: "WHM 188.132.235.10", isActive: true });
    expect(JSON.stringify(whm.config)).not.toContain("WHM-API-TOKEN-XYZ");
    expect((whm.config as Record<string, string>).apiToken).toMatch(/^enc:v1:/);
    // Virtualizor (frozen, hidden module) is mirrored too, so its services stay manageable.
    expect(state.instances.find((row) => row.legacySource === "vps_vds")).toMatchObject({ moduleId: "virtualizor", isActive: true });
    expect(state.serverUpdates[0]).toMatchObject({
      where: { moduleInstanceId: null, OR: [{ hostname: "188.132.235.10" }, { ipAddress: "188.132.235.10" }] },
    });
  });

  it("is idempotent and follows later Settings changes (one-way sync)", async () => {
    await syncLegacyModuleInstances();
    expect((await syncLegacyModuleInstances()).map((r) => r.action)).toEqual(["unchanged", "unchanged", "unchanged"]);

    state.settings.set("cpanel_default_plan", "kleacore_new");
    const [report] = await syncLegacyModuleInstances(["cpanel"]);
    expect(report.action).toBe("updated");
    expect(state.instances).toHaveLength(3);
    const config = parseStoredModuleConfig<CpanelWhmModuleConfig>(cpanelWhmModule, state.instances[0].config);
    expect(config.defaultPlan).toBe("kleacore_new");
  });

  it("skips unconfigured or non-migratable sources", async () => {
    state.settings.delete("cpanel_api_token");
    state.settings.set("registrar_provider", "generic-http");
    state.settings.set("vps_vds_provider", "disabled");

    const reports = await syncLegacyModuleInstances();

    expect(reports.every((r) => r.action === "skipped")).toBe(true);
    expect(state.instances).toHaveLength(0);
  });

  it("before/after: config resolved through each mirror equals what the legacy code reads from Settings", async () => {
    const before = {
      cpanel: await getCpanelWhmConfig(),
      registrar: await getRegistrarConfig(),
      vps: await getVpsVdsConfig(),
      payment: await getPaymentGatewayConfig(),
    };

    await syncLegacyModuleInstances();

    // Legacy readers return exactly the same values after the migration…
    expect(await getCpanelWhmConfig()).toEqual(before.cpanel);
    expect(await getRegistrarConfig()).toEqual(before.registrar);
    expect(await getVpsVdsConfig()).toEqual(before.vps);
    expect(await getPaymentGatewayConfig()).toEqual(before.payment);

    // …and the mirrors rebuild the same provider configs.
    const row = (source: string) => state.instances.find((item) => item.legacySource === source)!.config;
    const whm = parseStoredModuleConfig<CpanelWhmModuleConfig>(cpanelWhmModule, row("cpanel"));
    expect(legacyCpanelConfigFromInstance(whm, before.cpanel.enabled)).toEqual(before.cpanel);
    expect(toCpanelWhmClientConfig(whm)).toEqual({ ...before.cpanel, enabled: true });

    const gri = parseStoredModuleConfig<GriModuleConfig>(griModule, row("registrar"));
    expect(legacyGriConfigFromInstance(gri, before.registrar.enabled)).toEqual({ ...before.registrar, apiKey: undefined });

    const virt = parseStoredModuleConfig<VirtualizorModuleConfig>(virtualizorModule, row("vps_vds"));
    expect({ ...legacyVirtualizorConfigFromInstance(virt, before.vps.enabled), apiUsername: before.vps.apiUsername }).toEqual(before.vps);

    const verification = await verifyLegacyModuleInstances();
    expect(verification.map((v) => [v.source, v.equal, v.differences])).toEqual([
      ["cpanel", true, []],
      ["registrar", true, []],
      ["vps_vds", true, []],
    ]);
  });

  it("verification names the differing fields (never values) when a mirror drifted", async () => {
    await syncLegacyModuleInstances();
    state.settings.set("cpanel_host", "whm2.test");

    const [cpanel] = await verifyLegacyModuleInstances();

    expect(cpanel).toMatchObject({ source: "cpanel", equal: false, differences: ["host"] });
    expect(JSON.stringify(cpanel)).not.toContain("whm2.test");
  });
});
