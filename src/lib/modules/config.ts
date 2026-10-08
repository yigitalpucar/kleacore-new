/**
 * ModuleInstance.config storage: the manifest's configSchema output as JSON,
 * with every `secretFields` value encrypted by src/lib/secrets/crypto
 * ("enc:v1:…", AES-256-GCM keyed by ENCRYPTION_KEY). Server-only.
 */
import { decryptSecret, encryptSecret, isEncryptedValue } from "@/lib/secrets/crypto";
import { MASKED_SECRET_PLACEHOLDER } from "@/lib/secrets/setting-keys";
import type { AnyModuleManifest } from "./types";

export { MASKED_SECRET_PLACEHOLDER };

export class ModuleConfigError extends Error {
  constructor(
    message: string,
    readonly instanceId?: string
  ) {
    super(message);
    this.name = "ModuleConfigError";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

/** Validated config → JSON to store (secret fields encrypted). */
export function encryptModuleConfig(manifest: AnyModuleManifest, config: Record<string, unknown>) {
  const stored = asRecord(config);
  for (const field of manifest.secretFields) {
    const value = stored[field];
    if (typeof value === "string" && value) stored[field] = encryptSecret(value);
  }
  return stored;
}

/** Stored JSON → plain values (not yet schema-parsed). */
export function decryptModuleConfig(manifest: AnyModuleManifest, stored: unknown) {
  const config = asRecord(stored);
  for (const field of manifest.secretFields) {
    const value = config[field];
    if (typeof value === "string" && isEncryptedValue(value)) config[field] = decryptSecret(value);
  }
  return config;
}

/**
 * Stored JSON → typed config. Throws ModuleConfigError when the stored
 * config no longer satisfies the schema (e.g. a required field was added).
 */
export function parseStoredModuleConfig<TConfig = Record<string, unknown>>(
  manifest: AnyModuleManifest,
  stored: unknown,
  instanceId?: string
): TConfig {
  const parsed = manifest.configSchema.safeParse(decryptModuleConfig(manifest, stored));
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".") || "config").join(", ");
    throw new ModuleConfigError(`MODULE_CONFIG_INVALID: ${manifest.id} (${fields})`, instanceId);
  }
  return parsed.data as TConfig;
}

/** For the browser: secret values replaced by the mask, empty ones left empty. */
export function maskModuleConfig(manifest: AnyModuleManifest, stored: unknown) {
  const config = asRecord(stored);
  for (const field of manifest.secretFields) {
    config[field] = config[field] ? MASKED_SECRET_PLACEHOLDER : "";
  }
  return config;
}

/**
 * Admin form input → config to validate: a secret left empty or still showing
 * the mask keeps its current (decrypted) value.
 */
export function mergeSecretInput(
  manifest: AnyModuleManifest,
  input: Record<string, unknown>,
  currentStored: unknown
) {
  const current = decryptModuleConfig(manifest, currentStored);
  const merged = { ...input };
  for (const field of manifest.secretFields) {
    const value = merged[field];
    if (value === undefined || value === "" || value === MASKED_SECRET_PLACEHOLDER) {
      if (current[field] !== undefined && current[field] !== "") merged[field] = current[field];
      else delete merged[field];
    }
  }
  return merged;
}
