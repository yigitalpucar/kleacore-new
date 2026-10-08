/**
 * Module registry: manifest lookup by id / kind. Pure (no DB) — instance
 * lookups live in ./instances.ts. Server-only (manifests import API clients).
 */
import { MODULE_MANIFESTS } from "./manifests";
import { schemaShape } from "./schema-form";
import { isModuleKind, type AnyModuleManifest, type ModuleKind, type ModuleManifest } from "./types";

const MODULE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Kinds whose instance-backed manifests must provide `create()`. */
const CONTRACT_REQUIRED_KINDS: readonly ModuleKind[] = ["server", "registrar", "dns"];

/** Problems with a manifest's static shape; empty = valid. */
export function validateManifest(manifest: AnyModuleManifest): string[] {
  const problems: string[] = [];
  const at = `module "${manifest.id}"`;

  if (!MODULE_ID_PATTERN.test(manifest.id)) problems.push(`${at}: id must be kebab-case`);
  if (!isModuleKind(manifest.kind)) problems.push(`${at}: unknown kind "${String(manifest.kind)}"`);
  if (!manifest.name.trim()) problems.push(`${at}: name is required`);

  const shape = schemaShape(manifest.configSchema);
  if (!shape) {
    problems.push(`${at}: configSchema must be a z.object`);
  } else {
    for (const field of manifest.secretFields) {
      if (!(field in shape)) problems.push(`${at}: secret field "${field}" is not in configSchema`);
    }
  }

  if (new Set(manifest.capabilities).size !== manifest.capabilities.length) {
    problems.push(`${at}: duplicate capabilities`);
  }

  const storage = manifest.storage ?? "instance";
  if (storage === "instance" && CONTRACT_REQUIRED_KINDS.includes(manifest.kind) && !manifest.create) {
    problems.push(`${at}: ${manifest.kind} modules must implement create()`);
  }
  if (storage === "settings" && !manifest.settingsHref) {
    problems.push(`${at}: settings-backed modules need settingsHref`);
  }

  if (manifest.kind === "server" && manifest.productOptionsSchema && !schemaShape(manifest.productOptionsSchema)) {
    problems.push(`${at}: productOptionsSchema must be a z.object`);
  }
  if (manifest.kind !== "server" && (manifest.productOptionsSchema || manifest.productCategories)) {
    problems.push(`${at}: only server modules bind to products`);
  }

  return problems;
}

export interface ModuleRegistry {
  getModule(id: string): AnyModuleManifest | undefined;
  /** Visible modules of a kind (or all kinds); `includeHidden` for frozen ones. */
  listModules(kind?: ModuleKind, options?: { includeHidden?: boolean }): AnyModuleManifest[];
}

export function createModuleRegistry(manifests: readonly AnyModuleManifest[]): ModuleRegistry {
  const byId = new Map<string, AnyModuleManifest>();
  const problems: string[] = [];

  for (const manifest of manifests) {
    if (byId.has(manifest.id)) problems.push(`duplicate module id "${manifest.id}"`);
    problems.push(...validateManifest(manifest));
    byId.set(manifest.id, manifest);
  }

  if (problems.length) {
    throw new Error(`Invalid module registry:\n- ${problems.join("\n- ")}`);
  }

  return {
    getModule: (id) => byId.get(id),
    listModules: (kind, options = {}) =>
      [...byId.values()].filter(
        (manifest) => (!kind || manifest.kind === kind) && (options.includeHidden || !manifest.hidden)
      ),
  };
}

export const moduleRegistry = createModuleRegistry(MODULE_MANIFESTS);

export function getModule(id: string): AnyModuleManifest | undefined {
  return moduleRegistry.getModule(id);
}

/** Typed lookup when the caller knows the kind (throws for a mismatch). */
export function getModuleOfKind<K extends ModuleKind>(id: string, kind: K): ModuleManifest<K> {
  const manifest = moduleRegistry.getModule(id);
  if (!manifest) throw new Error(`MODULE_NOT_FOUND: ${id}`);
  if (manifest.kind !== kind) throw new Error(`MODULE_KIND_MISMATCH: ${id} is ${manifest.kind}, not ${kind}`);
  return manifest as unknown as ModuleManifest<K>;
}

export function listModules(kind?: ModuleKind, options?: { includeHidden?: boolean }) {
  return moduleRegistry.listModules(kind, options);
}

/** Visible server modules that may bind to products of a category. */
export function listServerModulesForCategory(categorySlug: string) {
  return listModules("server").filter(
    (manifest) =>
      (manifest.storage ?? "instance") === "instance" &&
      (!manifest.productCategories || manifest.productCategories.includes(categorySlug as never))
  );
}


export { parseProductOptions } from "./product-options";
