/**
 * Module registry types (Faz 2.1) — see docs/modules.md.
 *
 * A *manifest* describes a module type (WHM, Proxmox, Gri, Cloudflare …): its
 * config schema, secret fields, capabilities and a factory for its typed
 * capability contract. A *ModuleInstance* row is one configured copy of it
 * (two WHM servers = two instances of "cpanel-whm").
 *
 * Pure types + constants: safe to import from client components.
 */
import type { z } from "zod";
import type { ProductCategorySlug } from "@prisma/client";
import type { ModuleContracts } from "./contracts";

export const MODULE_KINDS = [
  "payment",
  "registrar",
  "server",
  "dns",
  "sms",
  "mail",
  "einvoice",
  "storage",
] as const;

/** Same values as the Prisma `ModuleKind` enum. */
export type ModuleKind = (typeof MODULE_KINDS)[number];

export const MODULE_KIND_LABELS: Record<ModuleKind, string> = {
  server: "Sunucu",
  registrar: "Alan adı kayıt",
  dns: "DNS",
  payment: "Ödeme",
  einvoice: "E-fatura",
  sms: "SMS",
  mail: "E-posta",
  storage: "Depolama",
};

export function isModuleKind(value: unknown): value is ModuleKind {
  return typeof value === "string" && (MODULE_KINDS as readonly string[]).includes(value);
}

/**
 * Capabilities per kind. Optional contract methods are only called when the
 * manifest declares the matching capability; `assertModuleContract`
 * (./testing.ts) checks that declarations and implementations agree.
 */
export interface CapabilitiesByKind {
  server:
    | "provision" // createAccount / suspend / unsuspend / terminate (required)
    | "changePackage" // required method, capability documents support
    | "usage" // getUsage
    | "bulkUsage" // listUsage (daily usage sync)
    | "sso" // getSsoUrl
    | "password" // resetPassword
    | "packages" // listPackages + resolvePackageName
    | "console" // getConsoleUrl
    | "power" // powerAction
    | "reinstall" // reinstall
    | "listAccounts" // listAccounts (importers)
    | "ipam"; // allocates addresses from an IpPool bound to the instance
  registrar:
    | "register"
    | "renew"
    | "transfer"
    | "nameservers"
    | "dnsRecords"
    | "availability"
    | "bulkAvailability" // checkDomainsAvailability
    | "domainInfo" // getDomainInfo (required in RegistrarModule)
    | "tldPricing" // fetchTldPricing
    | "listDomains" // listDomains (importers)
    | "eppCode" // getEppCode
    | "lock"; // setLock
  dns: "zones" | "records" | "proxy";
  payment: "checkout" | "refund" | "storedCard" | "installments";
  einvoice: "earsiv" | "efatura" | "cancel" | "pdf";
  sms: "send" | "deliveryReports";
  mail: "send" | "deliveryReports";
  storage: "put" | "get" | "delete" | "list";
}

export type CapabilityOf<K extends ModuleKind> = CapabilitiesByKind[K];

/** Result of a manifest health check ("Bağlantıyı test et"). */
export interface ModuleHealth {
  ok: boolean;
  /** Short Turkish/technical message shown to the admin. */
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * A ModuleInstance row with its config decrypted and parsed by the
 * manifest's configSchema. Never send this to the browser (contains secrets).
 */
export interface ResolvedModuleInstance<TConfig = Record<string, unknown>> {
  id: string;
  kind: ModuleKind;
  moduleId: string;
  label: string;
  config: TConfig;
  isActive: boolean;
  priority: number;
  groupKey: string | null;
  capacity: number | null;
  legacySource: string | null;
}

/** Labels/hints for the admin form generated from a zod schema. */
export interface FieldMeta {
  label?: string;
  hint?: string;
  placeholder?: string;
  /** Labels for z.enum values. */
  optionLabels?: Record<string, string>;
  /** Render as a multi-line textarea (strings) — e.g. SSH keys. */
  multiline?: boolean;
}

export type FieldMetaMap = Record<string, FieldMeta>;

/**
 * Where the module's configuration lives.
 * - "instance": ModuleInstance rows (server, registrar, dns …).
 * - "settings": the legacy Setting keys and their existing admin forms
 *   (payment gateways, e-invoice, SMS). The manifest is registered so the
 *   Modüller screen lists it and can health-check it, but instances can't be
 *   created yet.
 */
export type ModuleStorage = "instance" | "settings";

export interface ModuleManifest<
  K extends ModuleKind = ModuleKind,
  TConfig extends Record<string, unknown> = Record<string, unknown>,
  TOptions extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Stable id stored in ModuleInstance.moduleId, kebab-case ("cpanel-whm"). */
  id: string;
  kind: K;
  name: string;
  description: string;
  /** Instance config. Use defaults for optional values; keep it a z.object. */
  configSchema: z.ZodType<TConfig, z.ZodTypeDef, unknown>;
  /** Config keys stored encrypted and masked in the admin UI. */
  secretFields: readonly (keyof TConfig & string)[];
  configFields?: FieldMetaMap;
  capabilities: readonly CapabilityOf<K>[];
  /** Frozen / legacy modules (Virtualizor, Stripe): not offered for new instances. */
  hidden?: boolean;
  /** Defaults to "instance". */
  storage?: ModuleStorage;
  /** Settings-backed modules: where their existing form lives. */
  settingsHref?: string;
  /** Server modules: product categories that may bind to this module. */
  productCategories?: readonly ProductCategorySlug[];
  /** Server modules: Product.moduleOptions schema (WHM package, Proxmox template …). */
  productOptionsSchema?: z.ZodType<TOptions, z.ZodTypeDef, unknown>;
  productOptionsFields?: FieldMetaMap;
  /** Never throws: map failures to `{ ok: false, message }`. */
  healthCheck(instance: ResolvedModuleInstance<TConfig>): Promise<ModuleHealth>;
  /**
   * Builds the typed capability contract for an instance. Required for
   * instance-backed server/registrar/dns modules.
   */
  create?(instance: ResolvedModuleInstance<TConfig>): ModuleContracts<TOptions>[K];
  /** Settings-backed modules: reads the current config from Settings. */
  loadSettingsConfig?(): Promise<TConfig>;
}

/** Heterogeneous registry entry. */
export type AnyModuleManifest = ModuleManifest<ModuleKind, any, any>;

/** Identity helper that keeps the manifest's generic types inferred. */
export function defineModule<
  K extends ModuleKind,
  TConfig extends Record<string, unknown>,
  TOptions extends Record<string, unknown> = Record<string, never>,
>(manifest: ModuleManifest<K, TConfig, TOptions>): ModuleManifest<K, TConfig, TOptions> {
  return manifest;
}
