/**
 * ModuleInstance access (DB): resolve instances with decrypted, validated
 * config; pick the instance a product provisions on; run and record health
 * checks; create/update instances from the admin screen. Server-only.
 */
import type { ModuleInstance, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import {
  ModuleConfigError,
  decryptModuleConfig,
  encryptModuleConfig,
  mergeSecretInput,
  parseStoredModuleConfig,
} from "./config";
import type { ModuleContracts, ServerModule } from "./contracts";
import { getModule } from "./registry";
import type { ServerBinding } from "./server-bridge";
import type { AnyModuleManifest, ModuleHealth, ModuleKind, ResolvedModuleInstance } from "./types";

const log = createLogger("modules.instances");

type DbClient = Prisma.TransactionClient | typeof db;

/** Service statuses that occupy a slot on a server (least-loaded selection). */
const LOAD_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"] as const;

export const HEALTH_CHECK_TIMEOUT_MS = 15_000;

export function requireManifest(moduleId: string): AnyModuleManifest {
  const manifest = getModule(moduleId);
  if (!manifest) throw new ModuleConfigError(`MODULE_NOT_FOUND: ${moduleId}`);
  return manifest;
}

/** DB row → resolved instance (decrypts + validates config; throws ModuleConfigError). */
export function resolveInstanceRow<TConfig = Record<string, unknown>>(row: ModuleInstance): ResolvedModuleInstance<TConfig> {
  const manifest = requireManifest(row.moduleId);
  if (manifest.kind !== row.kind) {
    throw new ModuleConfigError(`MODULE_KIND_MISMATCH: ${row.moduleId} is ${manifest.kind}`, row.id);
  }
  return {
    id: row.id,
    kind: row.kind as ModuleKind,
    moduleId: row.moduleId,
    label: row.label,
    config: parseStoredModuleConfig<TConfig>(manifest, row.config, row.id),
    isActive: row.isActive,
    priority: row.priority,
    groupKey: row.groupKey,
    capacity: row.capacity,
    legacySource: row.legacySource,
  };
}

/** Instance by id with decrypted config, or null when it doesn't exist. */
export async function getInstance<TConfig = Record<string, unknown>>(
  id: string,
  client: DbClient = db
): Promise<ResolvedModuleInstance<TConfig> | null> {
  const row = await client.moduleInstance.findUnique({ where: { id } });
  return row ? resolveInstanceRow<TConfig>(row) : null;
}

/** Active instances of a kind, preferred first (priority asc, then oldest). */
export async function listActiveInstances(kind: ModuleKind, client: DbClient = db) {
  const rows = await client.moduleInstance.findMany({
    where: { kind, isActive: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  const resolved: ResolvedModuleInstance[] = [];
  for (const row of rows) {
    try {
      resolved.push(resolveInstanceRow(row));
    } catch (error) {
      log.warn("skipping instance with invalid config", { instanceId: row.id, error });
    }
  }
  return resolved;
}

/** Typed capability contract of an instance (manifest.create). */
export function createContract<K extends ModuleKind>(instance: ResolvedModuleInstance, kind: K): ModuleContracts[K] {
  const manifest = requireManifest(instance.moduleId);
  if (manifest.kind !== kind || !manifest.create) {
    throw new ModuleConfigError(`MODULE_CONTRACT_UNAVAILABLE: ${instance.moduleId} (${kind})`, instance.id);
  }
  return manifest.create(instance) as ModuleContracts[K];
}

/**
 * Which instance a new service of this product is provisioned on, or null
 * (unbound product → legacy/MANUAL flow; bound but nothing available → the
 * caller opens a MANUAL task).
 *
 * A product binds to one instance. If that instance has a `groupKey`, every
 * active instance with the same kind + moduleId + groupKey is a candidate
 * (a server pool) and the least loaded one wins: load = services in
 * PENDING/ACTIVE/SUSPENDED, compared as load/capacity when the instance has
 * a capacity (full instances are skipped), ties broken by priority (lower
 * first) then age. Without a groupKey the bound instance is used when active
 * and not full.
 */
export async function resolveInstanceForProduct(
  product: { moduleInstanceId?: string | null },
  client: DbClient = db
): Promise<ResolvedModuleInstance | null> {
  if (!product.moduleInstanceId) return null;

  const bound = await client.moduleInstance.findUnique({ where: { id: product.moduleInstanceId } });
  if (!bound) return null;

  const candidates = bound.groupKey
    ? await client.moduleInstance.findMany({
        where: { kind: bound.kind, moduleId: bound.moduleId, groupKey: bound.groupKey, isActive: true },
      })
    : bound.isActive
      ? [bound]
      : [];
  if (!candidates.length) return null;

  const loads = await client.service.groupBy({
    by: ["moduleInstanceId"],
    where: { moduleInstanceId: { in: candidates.map((c) => c.id) }, status: { in: [...LOAD_STATUSES] } },
    _count: { _all: true },
  });
  const loadOf = new Map(loads.map((row) => [row.moduleInstanceId, row._count._all]));

  const ranked = candidates
    .map((row) => {
      const load = loadOf.get(row.id) ?? 0;
      return { row, load, score: row.capacity ? load / row.capacity : load };
    })
    .filter((entry) => !entry.row.capacity || entry.load < entry.row.capacity)
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.row.priority - b.row.priority ||
        a.row.createdAt.getTime() - b.row.createdAt.getTime()
    );

  for (const entry of ranked) {
    try {
      return resolveInstanceRow(entry.row);
    } catch (error) {
      log.warn("skipping instance with invalid config", { instanceId: entry.row.id, error });
    }
  }
  return null;
}

/**
 * Server binding of an existing service: its own moduleInstanceId (the
 * account lives there, even if the instance was deactivated later). Null for
 * legacy services → caller uses the legacy Settings-backed provider.
 */
export async function getServerBindingForService(
  service: { moduleInstanceId?: string | null; product?: { moduleInstanceId?: string | null } | null },
  client: DbClient = db
): Promise<ServerBinding | null> {
  if (!service.moduleInstanceId) return null;

  const row = await client.moduleInstance.findUnique({ where: { id: service.moduleInstanceId } });
  if (!row) throw new ModuleConfigError(`MODULE_INSTANCE_NOT_FOUND: ${service.moduleInstanceId}`);
  const instance = resolveInstanceRow(row);
  const manifest = requireManifest(row.moduleId);
  if (manifest.kind !== "server") throw new ModuleConfigError(`MODULE_NOT_SERVER: ${row.moduleId}`, row.id);

  let productModuleId: string | null = null;
  const productInstanceId = service.product?.moduleInstanceId;
  if (productInstanceId) {
    productModuleId =
      productInstanceId === row.id
        ? row.moduleId
        : ((await client.moduleInstance.findUnique({ where: { id: productInstanceId }, select: { moduleId: true } }))
            ?.moduleId ?? null);
  }

  return {
    manifest,
    instance,
    module: createContract(instance, "server") as ServerModule,
    productModuleId,
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`HEALTH_CHECK_TIMEOUT (${ms / 1000} sn)`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function safeHealthCheck(manifest: AnyModuleManifest, instance: ResolvedModuleInstance): Promise<ModuleHealth> {
  try {
    return await withTimeout(manifest.healthCheck(instance), HEALTH_CHECK_TIMEOUT_MS);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "HEALTH_CHECK_FAILED" };
  }
}

/**
 * Runs the manifest's health check for an instance and records the outcome
 * (lastHealthAt / lastHealthStatus / lastHealthError). Never throws.
 */
export async function runHealthCheck(instanceOrId: string | ResolvedModuleInstance): Promise<ModuleHealth> {
  const id = typeof instanceOrId === "string" ? instanceOrId : instanceOrId.id;
  let health: ModuleHealth;

  try {
    const instance = typeof instanceOrId === "string" ? await getInstance(instanceOrId) : instanceOrId;
    if (!instance) return { ok: false, message: "MODULE_INSTANCE_NOT_FOUND" };
    health = await safeHealthCheck(requireManifest(instance.moduleId), instance);
  } catch (error) {
    health = { ok: false, message: error instanceof Error ? error.message : "HEALTH_CHECK_FAILED" };
  }

  await db.moduleInstance
    .update({
      where: { id },
      data: {
        lastHealthAt: new Date(),
        lastHealthStatus: health.ok ? "OK" : "ERROR",
        lastHealthError: health.ok ? null : (health.message ?? "HEALTH_CHECK_FAILED").slice(0, 500),
      },
    })
    .catch((error) => log.warn("could not record health", { instanceId: id, error }));

  return health;
}

/** Health check of a settings-backed module (payment, e-invoice, SMS). */
export async function runSettingsHealthCheck(moduleId: string): Promise<ModuleHealth> {
  const manifest = getModule(moduleId);
  if (!manifest || manifest.storage !== "settings") return { ok: false, message: "MODULE_NOT_FOUND" };
  const config = manifest.loadSettingsConfig ? await manifest.loadSettingsConfig() : {};
  return safeHealthCheck(manifest, {
    id: `settings:${moduleId}`,
    kind: manifest.kind,
    moduleId,
    label: manifest.name,
    config,
    isActive: true,
    priority: 0,
    groupKey: null,
    capacity: null,
    legacySource: "settings",
  });
}

export interface SaveModuleInstanceInput {
  id?: string;
  moduleId: string;
  label: string;
  /** Config before validation (secrets: empty or masked = keep current). Ignored for legacy-linked instances. */
  config?: Record<string, unknown>;
  isActive?: boolean;
  priority?: number;
  groupKey?: string | null;
  capacity?: number | null;
}

export type SaveModuleInstanceResult =
  | { ok: true; instance: ModuleInstance }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Creates or updates an instance; config is validated by the manifest's schema and secrets encrypted. */
export async function saveModuleInstance(input: SaveModuleInstanceInput): Promise<SaveModuleInstanceResult> {
  const manifest = getModule(input.moduleId);
  if (!manifest) return { ok: false, error: "Modül bulunamadı." };
  if ((manifest.storage ?? "instance") !== "instance") {
    return { ok: false, error: "Bu modülün ayarları Entegrasyonlar ekranında tutulur." };
  }

  const label = input.label.trim();
  if (!label) return { ok: false, error: "Etiket gerekli.", fieldErrors: { label: "Etiket gerekli." } };

  const existing = input.id ? await db.moduleInstance.findUnique({ where: { id: input.id } }) : null;
  if (input.id && !existing) return { ok: false, error: "Modül örneği bulunamadı." };
  if (existing && existing.moduleId !== manifest.id) return { ok: false, error: "Modül türü değiştirilemez." };
  if (!existing && manifest.hidden) return { ok: false, error: "Bu modül yeni kurulumlar için kapalı." };

  const common = {
    label,
    isActive: input.isActive ?? existing?.isActive ?? true,
    priority: Number.isFinite(input.priority) ? Math.trunc(input.priority!) : (existing?.priority ?? 0),
    groupKey: input.groupKey?.trim() || null,
    capacity: input.capacity && input.capacity > 0 ? Math.trunc(input.capacity) : null,
  };

  // Legacy-linked instances get their config from the Settings form only.
  if (existing?.legacySource) {
    const instance = await db.moduleInstance.update({ where: { id: existing.id }, data: common });
    return { ok: true, instance };
  }

  const merged = mergeSecretInput(manifest, input.config ?? {}, existing?.config);
  const parsed = manifest.configSchema.safeParse(merged);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "_")] ??= issue.message;
    return { ok: false, error: "Ayarlar geçersiz.", fieldErrors };
  }

  const config = encryptModuleConfig(manifest, parsed.data as Record<string, unknown>) as Prisma.InputJsonObject;
  const configChanged =
    !existing || JSON.stringify(decryptModuleConfig(manifest, existing.config)) !== JSON.stringify(parsed.data);
  const instance = existing
    ? await db.moduleInstance.update({
        where: { id: existing.id },
        data: {
          ...common,
          config,
          // New credentials invalidate the last health result.
          ...(configChanged ? { lastHealthStatus: "UNKNOWN" as const, lastHealthError: null, lastHealthAt: null } : {}),
        },
      })
    : await db.moduleInstance.create({
        data: { ...common, kind: manifest.kind, moduleId: manifest.id, config },
      });

  return { ok: true, instance };
}
