/**
 * cPanel/WHM server module (reseller or root WHM API token). Wraps the
 * existing WHM client (src/lib/integrations/provisioning/providers/
 * cpanel-whm-client.ts); provisioning matches the legacy Settings-backed
 * provider, except that package names follow the instance's reseller
 * prefix rule (`packagePrefix`).
 *
 * Extras (Faz 2.6): single sign-on (create_user_session), password reset
 * (passwd), usage per account (accountsummary + showbw) and for the whole
 * instance (listaccts + showbw), packages (listpkgs).
 */
import { randomInt } from "node:crypto";
import { z } from "zod";
import {
  CpanelWhmApiError,
  createCpanelWhmClient,
  type WhmListAccount,
} from "@/lib/integrations/provisioning/providers/cpanel-whm-client";
import type { CpanelWhmConfig } from "@/lib/integrations/provisioning/types";
import type { IntegrationResult } from "@/lib/integrations/settings";
import type {
  OperationResult,
  RemoteAccountUsage,
  RemotePackage,
  RemoteAccount,
  ServerAccountContext,
  ServerAccountCreated,
  ServerModule,
  ServerSsoApp,
  ServerUsage,
} from "../../contracts";
import { defineModule, type ResolvedModuleInstance } from "../../types";

export const cpanelWhmConfigSchema = z.object({
  host: z.string().trim().min(1, "Sunucu adresi gerekli"),
  port: z.coerce.number().int().min(1).max(65535).default(2087),
  username: z.string().trim().min(1, "WHM kullanıcı adı gerekli"),
  apiToken: z.string().min(1, "API token gerekli"),
  useSsl: z.boolean().default(true),
  defaultPlan: z.string().trim().default("default"),
  /**
   * WHM reseller (non-root) tokens only see packages they own, named
   * "<reseller>_<Paket>". "auto": prefix package names with "<username>_"
   * unless already prefixed or the user is root. "none": send as written.
   */
  packagePrefix: z.enum(["auto", "none"]).default("auto"),
});

export type CpanelWhmModuleConfig = z.infer<typeof cpanelWhmConfigSchema>;

export const cpanelWhmProductOptionsSchema = z.object({
  /** WHM package. Empty = product SKU, then the instance's default package (legacy behaviour). */
  package: z.string().trim().optional(),
});

export type CpanelWhmProductOptions = z.infer<typeof cpanelWhmProductOptionsSchema>;

const MODULE_ID = "cpanel-whm";

/** Connection settings only (module-level options such as packagePrefix stay out). */
export function toCpanelWhmClientConfig(config: CpanelWhmModuleConfig): CpanelWhmConfig {
  return {
    enabled: true,
    host: config.host,
    port: config.port,
    username: config.username,
    apiToken: config.apiToken,
    useSsl: config.useSsl,
    defaultPlan: config.defaultPlan,
  };
}

function errorResult<T = { reference?: string }>(error: unknown): IntegrationResult<T> {
  const message =
    error instanceof CpanelWhmApiError || error instanceof Error ? error.message : "CPANEL_WHM_ERROR";
  return { ok: false, provider: MODULE_ID, error: message };
}

function generatePassword(length = 16) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
  return Array.from({ length }, () => chars[randomInt(chars.length)]).join("");
}

/** Same rules as the legacy provider: service username, else domain/label based. */
export function whmUsernameFor(service: ServerAccountContext["service"]) {
  if (service.username?.trim()) {
    return service.username.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
  }
  const base = (service.domain || service.label || service.id)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);
  return base || `klea${service.id.slice(-6)}`;
}

function whmDomainFor(service: ServerAccountContext["service"]) {
  if (service.domain?.trim()) return service.domain.trim().toLowerCase();
  const host = service.product.sku || service.label || "example.com";
  return host.includes(".") ? host.toLowerCase() : `${host}.kleacore.local`;
}

/** Applies the reseller prefix rule (see `packagePrefix`) to a package name. */
export function prefixWhmPackage(name: string, config: Pick<CpanelWhmModuleConfig, "username" | "packagePrefix">) {
  const trimmed = name.trim();
  const owner = config.username.trim();
  if (!trimmed || config.packagePrefix === "none" || !owner || owner === "root") return trimmed;
  return trimmed.startsWith(`${owner}_`) ? trimmed : `${owner}_${trimmed}`;
}

/** Product package → product SKU → instance default, then the reseller prefix. */
export function whmPackageName(
  options: CpanelWhmProductOptions,
  product: { sku: string },
  config: CpanelWhmModuleConfig
) {
  return prefixWhmPackage(options.package?.trim() || product.sku?.trim() || config.defaultPlan, config);
}

export function whmPackageFor(
  ctx: ServerAccountContext<CpanelWhmProductOptions>,
  config: CpanelWhmModuleConfig
) {
  return whmPackageName(ctx.options, ctx.service.product, config);
}

/** cPanel app ids for create_user_session `app`. */
const SSO_APPS: Record<ServerSsoApp, string> = {
  fileManager: "FileManager_Home",
  emailAccounts: "Email_Accounts",
  phpMyAdmin: "Database_phpMyAdmin",
};

/**
 * WHM size strings → MB. "102M" / "1.5G" / "512K" / plain numbers (MB);
 * "unlimited" / "none" → null (no limit); unparseable → undefined.
 */
export function parseWhmMegabytes(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const text = String(value).trim().toLowerCase();
  if (text === "unlimited" || text === "none") return null;
  const match = /^(\d+(?:\.\d+)?)\s*([kmgt]?)b?$/.exec(text);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const factor = { "": 1, k: 1 / 1024, m: 1, g: 1024, t: 1024 * 1024 }[match[2] as "" | "k" | "m" | "g" | "t"];
  return Math.round(amount * factor * 100) / 100;
}

/** Bytes (number or numeric string) → MB; 0 / "unlimited" limits → null. */
function bytesToMegabytes(value: unknown, zeroIsUnlimited = false): number | null | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "string" && value.trim().toLowerCase() === "unlimited") return null;
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return undefined;
  if (zeroIsUnlimited && bytes <= 0) return null;
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

function usageFrom(
  account: { diskused?: unknown; disklimit?: unknown } | null,
  bandwidth: { totalbytes?: unknown; limit?: unknown } | undefined,
  collectedAt: Date
): ServerUsage {
  const usage: ServerUsage = { collectedAt };
  const diskUsed = parseWhmMegabytes(account?.diskused);
  const diskLimit = parseWhmMegabytes(account?.disklimit);
  if (typeof diskUsed === "number") usage.diskUsedMB = diskUsed;
  if (diskLimit !== undefined) usage.diskLimitMB = diskLimit;
  if (bandwidth) {
    usage.bandwidthUsedMB = bytesToMegabytes(bandwidth.totalbytes) ?? 0;
    const bandwidthLimit = bytesToMegabytes(bandwidth.limit, true);
    if (bandwidthLimit !== undefined) usage.bandwidthLimitMB = bandwidthLimit;
  }
  return usage;
}

/** Account the operation targets: remoteId, else the service username. */
function accountOf(ctx: ServerAccountContext<CpanelWhmProductOptions>) {
  return ctx.service.remoteId?.trim() || ctx.service.username?.trim() || "";
}

/** "150M" / "1.5G" / "none" / "unlimited" → MB (undefined = unknown / unlimited). */
export function parseWhmSize(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const match = /^\s*([\d.]+)\s*([KMGT]?)B?\s*$/i.exec(value);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  const factor = { "": 1, K: 1 / 1024, M: 1, G: 1024, T: 1024 * 1024 }[match[2].toUpperCase() as "" | "K" | "M" | "G" | "T"];
  return Math.round(amount * factor * 100) / 100;
}

/** WHM listaccts row → RemoteAccount (importers, 2.7). */
export function toRemoteAccount(account: WhmListAccount): RemoteAccount {
  const suspended = String(account.suspended ?? "0") === "1";
  const startSeconds = Number(account.unix_startdate);
  const reason = account.suspendreason?.trim();
  return {
    remoteId: account.user,
    username: account.user,
    domain: account.domain?.trim().toLowerCase() || undefined,
    email: account.email?.trim() && account.email.trim() !== "*unknown*" ? account.email.trim() : undefined,
    package: account.plan?.trim() || undefined,
    status: suspended ? "suspended" : "active",
    ipAddress: account.ip?.trim() || undefined,
    createdAt: Number.isFinite(startSeconds) && startSeconds > 0 ? new Date(startSeconds * 1000) : undefined,
    diskUsedMB: parseWhmSize(account.diskused),
    diskLimitMB: parseWhmSize(account.disklimit),
    suspendReason: suspended && reason && reason !== "not suspended" ? reason : undefined,
    raw: { owner: account.owner },
  };
}

export function createCpanelWhmModule(
  instance: ResolvedModuleInstance<CpanelWhmModuleConfig>
): ServerModule<CpanelWhmProductOptions> {
  const config = instance.config;
  const client = createCpanelWhmClient(toCpanelWhmClientConfig(config));

  async function onAccount(
    ctx: ServerAccountContext<CpanelWhmProductOptions>,
    run: (user: string) => Promise<unknown>
  ): Promise<OperationResult> {
    const user = accountOf(ctx);
    if (!user) return { ok: false, provider: MODULE_ID, error: "CPANEL_USERNAME_MISSING" };
    try {
      await run(user);
      return { ok: true, provider: MODULE_ID, reference: user };
    } catch (error) {
      return errorResult(error);
    }
  }

  return {
    moduleId: MODULE_ID,
    async createAccount(ctx) {
      const username = whmUsernameFor(ctx.service);
      const password = generatePassword();
      try {
        await client.createAccount({
          username,
          domain: whmDomainFor(ctx.service),
          plan: whmPackageFor(ctx, config),
          contactemail: ctx.service.customer?.email || "noreply@kleacore.com",
          password,
        });
        return {
          ok: true,
          provider: MODULE_ID,
          reference: username,
          data: { remoteId: username, username, password, hostname: config.host },
        };
      } catch (error) {
        return errorResult<ServerAccountCreated>(error);
      }
    },
    suspend: (ctx, reason) => onAccount(ctx, (user) => client.suspendAccount(user, reason)),
    unsuspend: (ctx) => onAccount(ctx, (user) => client.unsuspendAccount(user)),
    terminate: (ctx) => onAccount(ctx, (user) => client.terminateAccount(user)),
    changePackage: (ctx) => onAccount(ctx, (user) => client.changePackage(user, whmPackageFor(ctx, config))),

    async getSsoUrl(ctx, target = "panel", options) {
      const user = accountOf(ctx);
      if (!user) return { ok: false, provider: MODULE_ID, error: "CPANEL_USERNAME_MISSING" };
      try {
        const session = await client.createUserSession(
          user,
          target === "webmail" ? "webmaild" : "cpaneld",
          target === "panel" && options?.app ? SSO_APPS[options.app] : undefined
        );
        return {
          ok: true,
          provider: MODULE_ID,
          data: { url: session.url, ...(session.expires ? { expiresAt: new Date(session.expires * 1000) } : {}) },
        };
      } catch (error) {
        return errorResult(error);
      }
    },

    resetPassword: (ctx, password) => onAccount(ctx, (user) => client.setPassword(user, password)),

    async getUsage(ctx) {
      const user = accountOf(ctx);
      if (!user) return { ok: false, provider: MODULE_ID, error: "CPANEL_USERNAME_MISSING" };
      try {
        const [account, bandwidth] = await Promise.all([client.accountSummary(user), client.showBandwidth(user)]);
        if (!account) return { ok: false, provider: MODULE_ID, error: "CPANEL_ACCOUNT_NOT_FOUND" };
        return { ok: true, provider: MODULE_ID, data: usageFrom(account, bandwidth[0], new Date()) };
      } catch (error) {
        return errorResult(error);
      }
    },

    /** Two calls for the whole instance: listaccts (disk) + showbw (this month's traffic). */
    async listUsage() {
      try {
        const [accounts, bandwidth] = await Promise.all([client.listAccounts(), client.showBandwidth()]);
        const bandwidthByUser = new Map(bandwidth.map((row) => [row.user, row]));
        const collectedAt = new Date();
        const data: RemoteAccountUsage[] = accounts
          .filter((account) => typeof account.user === "string" && account.user)
          .map((account) => ({
            remoteId: account.user,
            usage: usageFrom(account, bandwidthByUser.get(account.user), collectedAt),
          }));
        return { ok: true, provider: MODULE_ID, data };
      } catch (error) {
        return errorResult<RemoteAccountUsage[]>(error);
      }
    },

    async listPackages() {
      try {
        const rows = await client.listPackages();
        const data: RemotePackage[] = rows.map((row) => ({
          name: row.name,
          diskLimitMB: parseWhmMegabytes(row.QUOTA),
          bandwidthLimitMB: parseWhmMegabytes(row.BWLIMIT),
        }));
        return { ok: true, provider: MODULE_ID, data };
      } catch (error) {
        return errorResult<RemotePackage[]>(error);
      }
    },

    resolvePackageName: (options, product) => whmPackageName(options, product, config),

    async listAccounts() {
      try {
        const accounts = await client.listAccounts();
        return { ok: true, provider: MODULE_ID, data: accounts.filter((account) => account.user).map(toRemoteAccount) };
      } catch (error) {
        return errorResult<RemoteAccount[]>(error);
      }
    },
  };
}

export const cpanelWhmModule = defineModule({
  id: MODULE_ID,
  kind: "server",
  name: "cPanel / WHM",
  description: "Paylaşımlı hosting ve e-posta hesaplarını WHM API ile açar, askıya alır ve kapatır.",
  configSchema: cpanelWhmConfigSchema,
  secretFields: ["apiToken"],
  configFields: {
    host: { label: "Sunucu adresi", placeholder: "whm.ornek.com veya IP" },
    port: { label: "WHM portu", hint: "Varsayılan 2087 (SSL)." },
    username: { label: "WHM kullanıcı adı", hint: "Bayi hesabı veya root." },
    apiToken: { label: "API token" },
    useSsl: { label: "SSL ile bağlan" },
    defaultPlan: { label: "Varsayılan paket", hint: "Üründe paket ve SKU yoksa kullanılır." },
    packagePrefix: {
      label: "Paket adı ön eki",
      hint: "Bayi (root olmayan) token'ları yalnızca kendi paketlerini görür; WHM bu paketleri “kullanıcıadı_Paket” olarak adlandırır.",
      optionLabels: {
        auto: "Otomatik: bayi kullanıcı adını ekle (ör. kleacore_Starter)",
        none: "Yok: paket adını olduğu gibi gönder",
      },
    },
  },
  capabilities: ["provision", "changePackage", "sso", "password", "usage", "bulkUsage", "packages", "listAccounts"],
  productCategories: ["hosting", "email"],
  productOptionsSchema: cpanelWhmProductOptionsSchema,
  productOptionsFields: {
    package: {
      label: "WHM paketi",
      hint: "Boş bırakılırsa ürün SKU'su, o da yoksa sunucunun varsayılan paketi kullanılır. Bayi ön eki (kleacore_) örnek ayarına göre otomatik eklenir.",
    },
  },
  async healthCheck(instance) {
    try {
      await createCpanelWhmClient(toCpanelWhmClientConfig(instance.config)).testConnection();
      return { ok: true, message: "WHM API yanıt verdi." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "CPANEL_WHM_ERROR" };
    }
  },
  create: createCpanelWhmModule,
});
