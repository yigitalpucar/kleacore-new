/**
 * Migration of the legacy Setting-backed configurations into ModuleInstance
 * rows (Faz 2.1) — idempotent, run from:
 *  - /yonetim/moduller → "Eski ayarları içe aktar" (production: no shell needed),
 *  - every save of the matching /yonetim/entegrasyonlar form (keeps the
 *    mirror in sync; one-way Settings → instance),
 *  - `pnpm modules:sync-legacy` locally.
 *
 * Why not a SQL data migration: secrets in Settings are encrypted with the
 * app's ENCRYPTION_KEY and env fallbacks (CPANEL_HOST …) only exist at
 * runtime, so only app code can read the effective config.
 *
 * Production safety: nothing reads these mirrors for existing traffic.
 * Unbound products and all registrar calls keep using the Settings-backed
 * providers; a mirror is used only after an admin binds a product to it.
 * Config resolved through a mirror equals the Settings config
 * (`verifyLegacyModuleInstances`, tests in legacy.test.ts).
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCpanelWhmConfig, getVpsVdsConfig } from "@/lib/integrations/provisioning/config";
import type { CpanelWhmConfig, VpsVdsConfig } from "@/lib/integrations/provisioning/types";
import { getRegistrarConfig, isGriConfigured, isGriProvider } from "@/lib/integrations/registrar/config";
import type { GriRegistrarConfig } from "@/lib/integrations/registrar/types";
import { createLogger } from "@/lib/logger";
import { decryptModuleConfig, encryptModuleConfig } from "./config";
import { cpanelWhmModule, toCpanelWhmClientConfig, type CpanelWhmModuleConfig } from "./server/cpanel-whm";
import { virtualizorModule, toVirtualizorConfig, type VirtualizorModuleConfig } from "./server/virtualizor";
import { griModule, toGriRegistrarConfig, type GriModuleConfig } from "./registrar/gri";
import type { AnyModuleManifest } from "./types";

const log = createLogger("modules.legacy");

export const LEGACY_SOURCES = ["cpanel", "registrar", "vps_vds"] as const;
export type LegacySource = (typeof LEGACY_SOURCES)[number];

export interface LegacySyncReport {
  source: LegacySource;
  action: "created" | "updated" | "unchanged" | "skipped";
  reason?: string;
  instanceId?: string;
  linkedServers?: number;
}

// --- Settings config ↔ instance config (pure) -----------------------------

export function cpanelInstanceConfigFromLegacy(config: CpanelWhmConfig): CpanelWhmModuleConfig {
  return {
    host: config.host,
    port: config.port,
    username: config.username,
    apiToken: config.apiToken,
    useSsl: config.useSsl,
    defaultPlan: config.defaultPlan,
    packagePrefix: "auto",
  };
}

/** What the legacy provider would get if it read the instance instead of Settings. */
export function legacyCpanelConfigFromInstance(config: CpanelWhmModuleConfig, enabled: boolean): CpanelWhmConfig {
  return { ...toCpanelWhmClientConfig(config), enabled };
}

export function griInstanceConfigFromLegacy(config: GriRegistrarConfig): GriModuleConfig {
  return {
    username: config.username ?? "",
    password: config.password ?? "",
    clientId: config.clientId ?? "",
    clientSecret: config.clientSecret ?? "",
    ...(config.apiUrl?.trim() ? { apiUrl: config.apiUrl.trim() } : {}),
    testMode: config.testMode,
  };
}

export function legacyGriConfigFromInstance(config: GriModuleConfig, enabled: boolean): GriRegistrarConfig {
  return { ...toGriRegistrarConfig(config), enabled };
}

export function virtualizorInstanceConfigFromLegacy(config: VpsVdsConfig): VirtualizorModuleConfig {
  return { apiUrl: config.apiUrl ?? "", apiKey: config.apiKey ?? "", apiPassword: config.apiPassword ?? "" };
}

export function legacyVirtualizorConfigFromInstance(config: VirtualizorModuleConfig, enabled: boolean): VpsVdsConfig {
  return { ...toVirtualizorConfig(config), enabled };
}

// --- Reading the effective legacy config ----------------------------------

type LegacyCandidate =
  | { ok: true; manifest: AnyModuleManifest; label: string; config: Record<string, unknown>; enabled: boolean; host?: string }
  | { ok: false; reason: string };

async function readLegacy(source: LegacySource): Promise<LegacyCandidate> {
  if (source === "cpanel") {
    const config = await getCpanelWhmConfig();
    if (!config.host || !config.username || !config.apiToken) return { ok: false, reason: "cPanel/WHM yapılandırılmamış" };
    return {
      ok: true,
      manifest: cpanelWhmModule,
      label: `WHM ${config.host}`,
      config: cpanelInstanceConfigFromLegacy(config),
      enabled: config.enabled,
      host: config.host,
    };
  }

  if (source === "registrar") {
    const config = await getRegistrarConfig();
    if (!isGriProvider(config)) return { ok: false, reason: `registrar sağlayıcısı "${config.provider}" (yalnızca Gri taşınır)` };
    if (!isGriConfigured(config)) return { ok: false, reason: "Gri yapılandırılmamış" };
    return { ok: true, manifest: griModule, label: "Gri", config: griInstanceConfigFromLegacy(config), enabled: config.enabled };
  }

  const config = await getVpsVdsConfig();
  if (config.provider !== "virtualizor") {
    return { ok: false, reason: `VPS sağlayıcısı "${config.provider}" (yalnızca Virtualizor taşınır)` };
  }
  if (!config.apiUrl || !config.apiKey || !config.apiPassword) return { ok: false, reason: "Virtualizor yapılandırılmamış" };
  return {
    ok: true,
    manifest: virtualizorModule,
    label: "Virtualizor (eski)",
    config: virtualizorInstanceConfigFromLegacy(config),
    enabled: config.enabled,
  };
}

async function syncOne(source: LegacySource): Promise<LegacySyncReport> {
  const legacy = await readLegacy(source);
  if (!legacy.ok) return { source, action: "skipped", reason: legacy.reason };

  const parsed = legacy.manifest.configSchema.safeParse(legacy.config);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    return { source, action: "skipped", reason: `geçersiz ayar: ${fields}` };
  }

  const config = parsed.data as Record<string, unknown>;
  const existing = await db.moduleInstance.findUnique({ where: { legacySource: source } });
  let report: LegacySyncReport;

  if (existing) {
    if (existing.moduleId !== legacy.manifest.id) {
      return { source, action: "skipped", reason: `mevcut örnek farklı modülde (${existing.moduleId})`, instanceId: existing.id };
    }
    const current = decryptModuleConfig(legacy.manifest, existing.config);
    if (JSON.stringify(current) === JSON.stringify(config)) {
      report = { source, action: "unchanged", instanceId: existing.id };
    } else {
      await db.moduleInstance.update({
        where: { id: existing.id },
        data: {
          config: encryptModuleConfig(legacy.manifest, config) as Prisma.InputJsonObject,
          lastHealthStatus: "UNKNOWN",
          lastHealthError: null,
          lastHealthAt: null,
        },
      });
      report = { source, action: "updated", instanceId: existing.id };
    }
  } else {
    const created = await db.moduleInstance.create({
      data: {
        kind: legacy.manifest.kind,
        moduleId: legacy.manifest.id,
        label: legacy.label,
        config: encryptModuleConfig(legacy.manifest, config) as Prisma.InputJsonObject,
        isActive: legacy.enabled,
        legacySource: source,
      },
    });
    report = { source, action: "created", instanceId: created.id };
  }

  // Monitored Server rows of the WHM host belong to its instance.
  if (source === "cpanel" && legacy.host && report.instanceId) {
    const linked = await db.server.updateMany({
      where: { moduleInstanceId: null, OR: [{ hostname: legacy.host }, { ipAddress: legacy.host }] },
      data: { moduleInstanceId: report.instanceId },
    });
    report.linkedServers = linked.count;
  }

  return report;
}

/** Creates/updates the legacy mirrors. Idempotent; never throws per source. */
export async function syncLegacyModuleInstances(
  sources: readonly LegacySource[] = LEGACY_SOURCES
): Promise<LegacySyncReport[]> {
  const reports: LegacySyncReport[] = [];
  for (const source of sources) {
    try {
      reports.push(await syncOne(source));
    } catch (error) {
      log.error("legacy module sync failed", { source, error });
      reports.push({ source, action: "skipped", reason: error instanceof Error ? error.message : "SYNC_FAILED" });
    }
  }
  return reports;
}

/** For the legacy save actions: refresh one mirror, never fail the save. */
export async function syncLegacyModuleInstanceQuietly(source: LegacySource) {
  try {
    await syncLegacyModuleInstances([source]);
  } catch (error) {
    log.warn("legacy module mirror refresh failed", { source, error });
  }
}

export interface LegacyVerification {
  source: LegacySource;
  instanceId?: string;
  /** True when resolving through the instance yields the Settings config. */
  equal: boolean;
  /** Differing field names (never values). */
  differences: string[];
  reason?: string;
}

function diffKeys(a: Record<string, unknown>, b: Record<string, unknown>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((key) => JSON.stringify(a[key] ?? null) !== JSON.stringify(b[key] ?? null)).sort();
}

/**
 * Before/after check: the provider config rebuilt from each mirror instance
 * equals the config the legacy code reads from Settings today.
 */
export async function verifyLegacyModuleInstances(): Promise<LegacyVerification[]> {
  const results: LegacyVerification[] = [];
  for (const source of LEGACY_SOURCES) {
    const row = await db.moduleInstance.findUnique({ where: { legacySource: source } });
    if (!row) {
      results.push({ source, equal: false, differences: [], reason: "örnek yok" });
      continue;
    }
    const manifest =
      source === "cpanel" ? cpanelWhmModule : source === "registrar" ? griModule : virtualizorModule;
    const parsed = manifest.configSchema.safeParse(decryptModuleConfig(manifest as AnyModuleManifest, row.config));
    if (!parsed.success) {
      results.push({ source, instanceId: row.id, equal: false, differences: [], reason: "örnek ayarı geçersiz" });
      continue;
    }

    let legacy: Record<string, unknown>;
    let fromInstance: Record<string, unknown>;
    if (source === "cpanel") {
      const settings = await getCpanelWhmConfig();
      legacy = { ...settings };
      fromInstance = { ...legacyCpanelConfigFromInstance(parsed.data as CpanelWhmModuleConfig, settings.enabled) };
    } else if (source === "registrar") {
      const settings = await getRegistrarConfig();
      legacy = { ...settings, apiKey: undefined };
      fromInstance = { ...legacyGriConfigFromInstance(parsed.data as GriModuleConfig, settings.enabled) };
    } else {
      const settings = await getVpsVdsConfig();
      legacy = { ...settings, apiUsername: undefined };
      fromInstance = { ...legacyVirtualizorConfigFromInstance(parsed.data as VirtualizorModuleConfig, settings.enabled), apiUsername: undefined };
    }

    const differences = diffKeys(legacy, fromInstance);
    results.push({ source, instanceId: row.id, equal: differences.length === 0, differences });
  }
  return results;
}
