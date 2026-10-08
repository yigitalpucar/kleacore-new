/**
 * cPanel/WHM server module (reseller or root WHM API token). Wraps the
 * existing WHM client (src/lib/integrations/provisioning/providers/
 * cpanel-whm-client.ts); behaviour matches the legacy Settings-backed
 * provider so a product moved onto an instance provisions identically.
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
  RemoteAccount,
  ServerAccountContext,
  ServerAccountCreated,
  ServerModule,
} from "../../contracts";
import { defineModule, type ResolvedModuleInstance } from "../../types";

export const cpanelWhmConfigSchema = z.object({
  host: z.string().trim().min(1, "Sunucu adresi gerekli"),
  port: z.coerce.number().int().min(1).max(65535).default(2087),
  username: z.string().trim().min(1, "WHM kullanıcı adı gerekli"),
  apiToken: z.string().min(1, "API token gerekli"),
  useSsl: z.boolean().default(true),
  defaultPlan: z.string().trim().default("default"),
});

export type CpanelWhmModuleConfig = z.infer<typeof cpanelWhmConfigSchema>;

export const cpanelWhmProductOptionsSchema = z.object({
  /** WHM package. Empty = product SKU, then the instance's default package (legacy behaviour). */
  package: z.string().trim().optional(),
});

export type CpanelWhmProductOptions = z.infer<typeof cpanelWhmProductOptionsSchema>;

const MODULE_ID = "cpanel-whm";

export function toCpanelWhmClientConfig(config: CpanelWhmModuleConfig): CpanelWhmConfig {
  return { enabled: true, ...config };
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

export function whmPackageFor(
  ctx: ServerAccountContext<CpanelWhmProductOptions>,
  config: CpanelWhmModuleConfig
) {
  return ctx.options.package?.trim() || ctx.service.product.sku?.trim() || config.defaultPlan;
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
  },
  capabilities: ["provision", "changePackage", "listAccounts"],
  productCategories: ["hosting", "email"],
  productOptionsSchema: cpanelWhmProductOptionsSchema,
  productOptionsFields: {
    package: { label: "WHM paketi", hint: "Boş bırakılırsa ürün SKU'su, o da yoksa sunucunun varsayılan paketi kullanılır." },
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
