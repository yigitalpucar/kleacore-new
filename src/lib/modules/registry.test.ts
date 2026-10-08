import { describe, expect, it } from "vitest";
import { z } from "zod";

process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

import { memoryDnsModule, type MemoryDnsConfig } from "./examples/memory-dns";
import {
  createModuleRegistry,
  getModule,
  listModules,
  listServerModulesForCategory,
  moduleRegistry,
  parseProductOptions,
  validateManifest,
} from "./registry";
import { assertModuleContract, makeTestInstance } from "./testing";
import { defineModule, MODULE_KINDS, type AnyModuleManifest } from "./types";

const base = {
  name: "Test",
  description: "",
  configSchema: z.object({ token: z.string() }),
  secretFields: ["token"] as const,
  healthCheck: async () => ({ ok: true }),
};

describe("module registry", () => {
  it("builds the production registry with valid, unique manifests", () => {
    const all = moduleRegistry.listModules(undefined, { includeHidden: true });
    expect(all.length).toBeGreaterThan(5);
    for (const manifest of all) expect(validateManifest(manifest), manifest.id).toEqual([]);
    expect(new Set(all.map((m) => m.id)).size).toBe(all.length);
    for (const manifest of all) expect(MODULE_KINDS).toContain(manifest.kind);
  });

  it("registers the existing providers under the expected kinds", () => {
    expect(getModule("cpanel-whm")?.kind).toBe("server");
    expect(getModule("gri")?.kind).toBe("registrar");
    expect(getModule("virtualizor")).toMatchObject({ kind: "server", hidden: true });
    expect(getModule("kuveytturk")).toMatchObject({ kind: "payment", storage: "settings" });
    expect(getModule("uyumsoft")).toMatchObject({ kind: "einvoice", storage: "settings" });
  });

  it("hides frozen modules unless asked", () => {
    expect(listModules("server").map((m) => m.id)).not.toContain("virtualizor");
    expect(listModules("server", { includeHidden: true }).map((m) => m.id)).toContain("virtualizor");
    expect(listModules("payment").map((m) => m.id)).not.toContain("stripe");
  });

  it("offers server modules by product category", () => {
    expect(listServerModulesForCategory("hosting").map((m) => m.id)).toContain("cpanel-whm");
    expect(listServerModulesForCategory("vds").map((m) => m.id)).not.toContain("cpanel-whm");
  });

  it("rejects duplicate ids and invalid manifests", () => {
    const a = defineModule({ ...base, id: "dup", kind: "sms", capabilities: ["send"] });
    expect(() => createModuleRegistry([a, a])).toThrow(/duplicate module id "dup"/);

    const badSecret = { ...base, id: "bad-secret", kind: "sms", capabilities: [], secretFields: ["nope"] } as unknown as AnyModuleManifest;
    expect(validateManifest(badSecret)).toEqual([expect.stringMatching(/secret field "nope"/)]);

    const noCreate = defineModule({ ...base, id: "no-create", kind: "server", capabilities: ["provision"] });
    expect(validateManifest(noCreate)).toEqual([expect.stringMatching(/must implement create/)]);

    const badId = defineModule({ ...base, id: "Bad_Id", kind: "sms", capabilities: [] });
    expect(validateManifest(badId)).toEqual([expect.stringMatching(/kebab-case/)]);

    const settingsNoHref = defineModule({ ...base, id: "s", kind: "payment", storage: "settings", capabilities: [] });
    expect(validateManifest(settingsNoHref)).toEqual([expect.stringMatching(/settingsHref/)]);

    const dnsWithOptions = defineModule({
      ...base,
      id: "dns-opts",
      kind: "dns",
      capabilities: [],
      productOptionsSchema: z.object({}),
      create: memoryDnsModule.create as never,
    });
    expect(validateManifest(dnsWithOptions)).toEqual([expect.stringMatching(/only server modules/)]);
  });

  it("checks declared capabilities against implemented methods", () => {
    const instance = makeTestInstance<MemoryDnsConfig>(memoryDnsModule, { apiToken: "t" });
    expect(() => assertModuleContract(memoryDnsModule, memoryDnsModule.create!(instance))).not.toThrow();

    const whm = getModule("cpanel-whm")!;
    const contract = whm.create!(makeTestInstance(whm, { host: "whm.test", username: "u", apiToken: "t" }));
    expect(() => assertModuleContract(whm, contract)).not.toThrow();
    // Implementing an optional method without declaring its capability is an error…
    expect(() => assertModuleContract(whm, { ...(contract as object), getConsoleUrl: async () => ({ ok: true }) })).toThrow(
      /getConsoleUrl\(\) implemented but capability "console" not declared/
    );
    // …and so is declaring one without the method.
    expect(() => assertModuleContract({ ...whm, capabilities: [...whm.capabilities, "power"] }, contract)).toThrow(
      /capability "power" declared but powerAction\(\) missing/
    );
  });
});

describe("product options validation", () => {
  const whm = getModule("cpanel-whm")!;

  it("accepts WHM options and keeps the package", () => {
    expect(parseProductOptions(whm, { package: " kc_basic " })).toEqual({ success: true, data: { package: "kc_basic" } });
    expect(parseProductOptions(whm, {})).toEqual({ success: true, data: {} });
    expect(parseProductOptions(whm, null)).toEqual({ success: true, data: {} });
  });

  it("rejects wrongly typed options with field errors", () => {
    const result = parseProductOptions(whm, { package: 42 });
    expect(result).toMatchObject({ success: false, fieldErrors: { package: expect.any(String) } });
    expect(result.success === false && result.error).toMatch(/^MODULE_OPTIONS_INVALID: cpanel-whm/);
  });

  it("validates a Proxmox-style schema (numbers, ranges, required fields)", () => {
    const manifest = defineModule({
      ...base,
      id: "pve-like",
      kind: "server",
      capabilities: ["provision"],
      create: () => ({}) as never,
      productOptionsSchema: z.object({
        templateVmid: z.coerce.number().int().min(100),
        cores: z.coerce.number().int().min(1).max(64).default(1),
        memoryMB: z.coerce.number().int().min(512),
        bridge: z.string().default("vmbr0"),
      }),
    });
    expect(parseProductOptions(manifest, { templateVmid: "9000", memoryMB: 2048 })).toEqual({
      success: true,
      data: { templateVmid: 9000, cores: 1, memoryMB: 2048, bridge: "vmbr0" },
    });
    const bad = parseProductOptions(manifest, { templateVmid: 5, cores: 128 });
    expect(bad.success).toBe(false);
    expect(bad.success === false && Object.keys(bad.fieldErrors).sort()).toEqual(["cores", "memoryMB", "templateVmid"]);
  });
});
