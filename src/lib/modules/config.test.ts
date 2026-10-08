import { describe, expect, it } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

import {
  ModuleConfigError,
  MASKED_SECRET_PLACEHOLDER,
  encryptModuleConfig,
  maskModuleConfig,
  mergeSecretInput,
  parseStoredModuleConfig,
} from "./config";
import { cpanelWhmModule } from "./server/cpanel-whm";
import { griModule } from "./registrar/gri";
import { assertConfigRoundTrip } from "./testing";

const whmConfig = { host: "whm.test", port: 2087, username: "kleacore", apiToken: "TOKEN-123", useSsl: true, defaultPlan: "default" };

describe("module config encryption", () => {
  it("encrypts only secret fields and round-trips", () => {
    const stored = encryptModuleConfig(cpanelWhmModule, whmConfig);
    expect(stored.apiToken).toMatch(/^enc:v1:/);
    expect(stored.host).toBe("whm.test");
    expect(JSON.stringify(stored)).not.toContain("TOKEN-123");
    expect(parseStoredModuleConfig(cpanelWhmModule, stored)).toEqual(whmConfig);
    assertConfigRoundTrip(cpanelWhmModule, whmConfig);
    assertConfigRoundTrip(griModule, { username: "u", password: "p@ss-w0rd-123", clientId: "c", clientSecret: "client-secret-456", testMode: true });
  });

  it("does not double-encrypt an already encrypted value", () => {
    const once = encryptModuleConfig(cpanelWhmModule, whmConfig);
    const twice = encryptModuleConfig(cpanelWhmModule, once);
    expect(twice.apiToken).toBe(once.apiToken);
  });

  it("masks secrets for the browser", () => {
    const stored = encryptModuleConfig(cpanelWhmModule, whmConfig);
    expect(maskModuleConfig(cpanelWhmModule, stored)).toMatchObject({ host: "whm.test", apiToken: MASKED_SECRET_PLACEHOLDER });
    expect(maskModuleConfig(cpanelWhmModule, { ...whmConfig, apiToken: "" }).apiToken).toBe("");
  });

  it("keeps the stored secret when the form leaves it empty or masked", () => {
    const stored = encryptModuleConfig(cpanelWhmModule, whmConfig);
    expect(mergeSecretInput(cpanelWhmModule, { host: "x", apiToken: "" }, stored).apiToken).toBe("TOKEN-123");
    expect(mergeSecretInput(cpanelWhmModule, { host: "x", apiToken: MASKED_SECRET_PLACEHOLDER }, stored).apiToken).toBe("TOKEN-123");
    expect(mergeSecretInput(cpanelWhmModule, { host: "x", apiToken: "NEW" }, stored).apiToken).toBe("NEW");
    expect(mergeSecretInput(cpanelWhmModule, { host: "x" }, undefined)).toEqual({ host: "x" });
  });

  it("throws ModuleConfigError for a stored config that no longer validates", () => {
    expect(() => parseStoredModuleConfig(cpanelWhmModule, { host: "whm.test" }, "mi-1")).toThrow(ModuleConfigError);
    expect(() => parseStoredModuleConfig(cpanelWhmModule, { host: "whm.test" }, "mi-1")).toThrow(/username, apiToken/);
  });

  it("an undecryptable secret (rotated key) fails validation instead of leaking ciphertext", () => {
    const stored = encryptModuleConfig(cpanelWhmModule, whmConfig);
    process.env.ENCRYPTION_KEY = "another-key-another-key-another-key!!";
    try {
      expect(() => parseStoredModuleConfig(cpanelWhmModule, stored)).toThrow(/apiToken/);
    } finally {
      process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";
    }
  });
});
