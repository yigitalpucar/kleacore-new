import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

const mocks = vi.hoisted(() => ({
  productFindUnique: vi.fn(),
  productUpdate: vi.fn(),
  moduleInstanceFindUnique: vi.fn(),
  getInstance: vi.fn(),
  listPackages: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    product: { findUnique: mocks.productFindUnique, update: mocks.productUpdate },
    moduleInstance: { findUnique: mocks.moduleInstanceFindUnique },
  },
}));
vi.mock("@/lib/utils/auth-helpers", () => ({ requireAdmin: vi.fn().mockResolvedValue({ user: { id: "adm-1" } }) }));
vi.mock("@/lib/activity-log", () => ({ logActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/modules/legacy", () => ({ syncLegacyModuleInstances: vi.fn(), verifyLegacyModuleInstances: vi.fn() }));
vi.mock("@/lib/modules/instances", async () => {
  const { getModule } = await import("@/lib/modules/registry");
  return {
    requireManifest: (id: string) => getModule(id),
    getInstance: mocks.getInstance,
    createContract: (instance: { config: Record<string, unknown> }) => {
      // Real resolution rules, fixture listpkgs (no HTTP).
      const real = getModule("cpanel-whm")!.create!(instance as never) as unknown as Record<string, unknown>;
      return { ...real, listPackages: mocks.listPackages };
    },
    runHealthCheck: vi.fn(),
    runSettingsHealthCheck: vi.fn(),
    saveModuleInstance: vi.fn(),
  };
});

import { checkProductPackagesAction, saveProductModuleBindingAction } from "./modules";

const whmInstance = {
  id: "mi-whm",
  kind: "server",
  moduleId: "cpanel-whm",
  label: "WHM",
  config: { host: "whm.test", port: 2087, username: "kleacore", apiToken: "t", useSsl: true, defaultPlan: "default", packagePrefix: "auto" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.productFindUnique.mockResolvedValue({ id: "prd-1", sku: "HOST-1", category: { slug: "hosting", name: "Hosting" } });
  mocks.moduleInstanceFindUnique.mockResolvedValue({ id: "mi-whm", kind: "server", moduleId: "cpanel-whm" });
  mocks.getInstance.mockResolvedValue(whmInstance);
  mocks.listPackages.mockResolvedValue({ ok: true, data: [{ name: "kleacore_Pro" }, { name: "kleacore_Starter" }] });
});

describe("product Otomasyon: WHM packages", () => {
  it("lists packages and checks the prefixed package name", async () => {
    const result = await checkProductPackagesAction("prd-1", { moduleInstanceId: "mi-whm", values: { package: "Starter" } });
    expect(result).toEqual({
      success: true,
      check: {
        supported: true,
        packages: [{ name: "kleacore_Pro" }, { name: "kleacore_Starter" }],
        resolved: "kleacore_Starter",
        exists: true,
      },
    });
  });

  it("refuses to save a package the reseller doesn't have", async () => {
    const result = await saveProductModuleBindingAction("prd-1", { moduleInstanceId: "mi-whm", values: { package: "Gold" } });
    expect(result).toMatchObject({ success: false, fieldErrors: { package: expect.stringContaining("kleacore_Gold") } });
    expect(mocks.productUpdate).not.toHaveBeenCalled();
  });

  it("saves an existing package", async () => {
    const result = await saveProductModuleBindingAction("prd-1", { moduleInstanceId: "mi-whm", values: { package: "kleacore_Pro" } });
    expect(result).toEqual({ success: true });
    expect(mocks.productUpdate).toHaveBeenCalledWith({
      where: { id: "prd-1" },
      data: { moduleInstanceId: "mi-whm", moduleOptions: { package: "kleacore_Pro" } },
    });
  });

  it("saves with a warning when the panel can't be reached", async () => {
    mocks.listPackages.mockResolvedValue({ ok: false, error: "CPANEL_WHM_TIMEOUT" });
    const result = await saveProductModuleBindingAction("prd-1", { moduleInstanceId: "mi-whm", values: { package: "Gold" } });
    expect(result).toMatchObject({ success: true, warning: expect.stringContaining("CPANEL_WHM_TIMEOUT") });
    expect(mocks.productUpdate).toHaveBeenCalled();
  });
});
