/**
 * Serialisable views of manifests and instances for the admin screens
 * (/yonetim/moduller, product "Otomasyon" section, service detail). Secrets
 * never leave the server: configs are masked. Server-only.
 */
import { db } from "@/lib/db";
import { maskModuleConfig } from "./config";
import { getModule, listModules } from "./registry";
import { describeSchema, type SchemaFieldDescriptor } from "./schema-form";
import { MODULE_KIND_LABELS, type AnyModuleManifest, type ModuleKind } from "./types";

export interface ManifestView {
  id: string;
  kind: ModuleKind;
  name: string;
  description: string;
  capabilities: string[];
  hidden: boolean;
  storage: "instance" | "settings";
  settingsHref: string | null;
  productCategories: string[] | null;
}

export interface InstanceView {
  id: string;
  kind: ModuleKind;
  moduleId: string;
  moduleName: string;
  label: string;
  isActive: boolean;
  priority: number;
  groupKey: string | null;
  capacity: number | null;
  legacySource: string | null;
  lastHealthAt: string | null;
  lastHealthStatus: "UNKNOWN" | "OK" | "ERROR";
  lastHealthError: string | null;
  serviceCount: number;
  productCount: number;
}

export function toManifestView(manifest: AnyModuleManifest): ManifestView {
  return {
    id: manifest.id,
    kind: manifest.kind,
    name: manifest.name,
    description: manifest.description,
    capabilities: [...manifest.capabilities],
    hidden: Boolean(manifest.hidden),
    storage: manifest.storage ?? "instance",
    settingsHref: manifest.settingsHref ?? null,
    productCategories: manifest.productCategories ? [...manifest.productCategories] : null,
  };
}

const instanceSelect = {
  id: true,
  kind: true,
  moduleId: true,
  label: true,
  isActive: true,
  priority: true,
  groupKey: true,
  capacity: true,
  legacySource: true,
  lastHealthAt: true,
  lastHealthStatus: true,
  lastHealthError: true,
  config: true,
  _count: { select: { services: true, products: true } },
} as const;

type InstanceRow = {
  id: string;
  kind: string;
  moduleId: string;
  label: string;
  isActive: boolean;
  priority: number;
  groupKey: string | null;
  capacity: number | null;
  legacySource: string | null;
  lastHealthAt: Date | null;
  lastHealthStatus: "UNKNOWN" | "OK" | "ERROR";
  lastHealthError: string | null;
  _count: { services: number; products: number };
};

function toInstanceView(row: InstanceRow): InstanceView {
  return {
    id: row.id,
    kind: row.kind as ModuleKind,
    moduleId: row.moduleId,
    moduleName: getModule(row.moduleId)?.name ?? row.moduleId,
    label: row.label,
    isActive: row.isActive,
    priority: row.priority,
    groupKey: row.groupKey,
    capacity: row.capacity,
    legacySource: row.legacySource,
    lastHealthAt: row.lastHealthAt?.toISOString() ?? null,
    lastHealthStatus: row.lastHealthStatus,
    lastHealthError: row.lastHealthError,
    serviceCount: row._count.services,
    productCount: row._count.products,
  };
}

/** Infrastructure first, then billing/notification kinds. */
const KIND_DISPLAY_ORDER: readonly ModuleKind[] = ["server", "registrar", "dns", "payment", "einvoice", "sms", "mail", "storage"];

export interface ModulesOverview {
  kinds: Array<{ kind: ModuleKind; label: string; manifests: ManifestView[]; instances: InstanceView[] }>;
}

export async function getModulesOverview(): Promise<ModulesOverview> {
  const rows = await db.moduleInstance.findMany({
    select: instanceSelect,
    orderBy: [{ kind: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
  });
  const instances = rows.map(toInstanceView);
  const usedModuleIds = new Set(instances.map((instance) => instance.moduleId));

  return {
    kinds: KIND_DISPLAY_ORDER.map((kind) => ({
      kind,
      label: MODULE_KIND_LABELS[kind],
      // Hidden (frozen) modules are listed only when an instance still uses them.
      manifests: listModules(kind, { includeHidden: true })
        .filter((manifest) => !manifest.hidden || usedModuleIds.has(manifest.id))
        .map(toManifestView),
      instances: instances.filter((instance) => instance.kind === kind),
    })),
  };
}

export interface InstanceFormView {
  manifest: ManifestView;
  fields: SchemaFieldDescriptor[];
  /** Masked config (secrets → "********"). */
  values: Record<string, unknown>;
  instance: InstanceView | null;
  bound: { products: Array<{ id: string; name: string; sku: string }>; servers: Array<{ id: string; name: string; hostname: string }> };
}

export async function getInstanceFormView(id: string): Promise<InstanceFormView | null> {
  const row = await db.moduleInstance.findUnique({
    where: { id },
    select: {
      ...instanceSelect,
      products: { select: { id: true, name: true, sku: true }, orderBy: { name: "asc" }, take: 50 },
      servers: { select: { id: true, name: true, hostname: true }, take: 50 },
    },
  });
  if (!row) return null;
  const manifest = getModule(row.moduleId);
  if (!manifest) return null;
  return {
    manifest: toManifestView(manifest),
    fields: describeSchema(manifest.configSchema, manifest.configFields, manifest.secretFields),
    values: maskModuleConfig(manifest, row.config),
    instance: toInstanceView(row),
    bound: { products: row.products, servers: row.servers },
  };
}

export function getNewInstanceFormView(moduleId: string): InstanceFormView | null {
  const manifest = getModule(moduleId);
  if (!manifest || manifest.hidden || (manifest.storage ?? "instance") !== "instance") return null;
  return {
    manifest: toManifestView(manifest),
    fields: describeSchema(manifest.configSchema, manifest.configFields, manifest.secretFields),
    values: {},
    instance: null,
    bound: { products: [], servers: [] },
  };
}

export interface ProductBindingOption {
  instanceId: string;
  label: string;
  moduleId: string;
  moduleName: string;
  isActive: boolean;
  groupKey: string | null;
  optionFields: SchemaFieldDescriptor[];
}

/**
 * Server instances a product of this category may bind to (plus the one it
 * is bound to now, even if inactive), with each module's option fields.
 */
export async function getProductBindingOptions(categorySlug: string, currentInstanceId: string | null) {
  const rows = await db.moduleInstance.findMany({
    where: { kind: "server", OR: [{ isActive: true }, ...(currentInstanceId ? [{ id: currentInstanceId }] : [])] },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    select: { id: true, label: true, moduleId: true, isActive: true, groupKey: true },
  });

  const options: ProductBindingOption[] = [];
  for (const row of rows) {
    const manifest = getModule(row.moduleId);
    if (!manifest) continue;
    const allowed = !manifest.productCategories || manifest.productCategories.includes(categorySlug as never);
    if (!allowed && row.id !== currentInstanceId) continue;
    options.push({
      instanceId: row.id,
      label: row.label,
      moduleId: row.moduleId,
      moduleName: manifest.name,
      isActive: row.isActive,
      groupKey: row.groupKey,
      optionFields: manifest.productOptionsSchema
        ? describeSchema(manifest.productOptionsSchema, manifest.productOptionsFields)
        : [],
    });
  }
  return options;
}

/** Service detail: module + remote id, and server instances an admin may link a legacy service to. */
export async function getServiceModuleView(service: { moduleInstanceId: string | null; remoteId: string | null }) {
  const [current, choices] = await Promise.all([
    service.moduleInstanceId
      ? db.moduleInstance.findUnique({
          where: { id: service.moduleInstanceId },
          select: { id: true, label: true, moduleId: true, isActive: true },
        })
      : null,
    db.moduleInstance.findMany({
      where: { kind: "server" },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      select: { id: true, label: true, moduleId: true },
    }),
  ]);
  return {
    current: current ? { ...current, moduleName: getModule(current.moduleId)?.name ?? current.moduleId } : null,
    remoteId: service.remoteId,
    choices: choices.map((choice) => ({ id: choice.id, label: `${choice.label} · ${getModule(choice.moduleId)?.name ?? choice.moduleId}` })),
  };
}
