/**
 * Gri registrar module. Wraps the existing provider
 * (src/lib/integrations/registrar/providers/gri.ts). Domain operations in
 * production still resolve through the Settings-backed
 * `getRegistrarProvider()`; the instance (mirrored from those settings) is
 * what importers and future multi-registrar routing use.
 */
import { z } from "zod";
import { createGriRegistrarProvider, listGriDomains } from "@/lib/integrations/registrar/providers/gri";
import type { GriRegistrarConfig } from "@/lib/integrations/registrar/types";
import type { RegistrarModule } from "../../contracts";
import { defineModule } from "../../types";

export const griConfigSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  clientId: z.string().trim().min(1),
  clientSecret: z.string().min(1),
  /** Empty = Gri's production (or sandbox, with testMode) URL. */
  apiUrl: z.string().trim().url().optional(),
  testMode: z.boolean().default(false),
});

export type GriModuleConfig = z.infer<typeof griConfigSchema>;

export function toGriRegistrarConfig(config: GriModuleConfig): GriRegistrarConfig {
  return { enabled: true, provider: "gri", ...config, apiUrl: config.apiUrl ?? "" };
}

export function createGriModule(config: GriModuleConfig): RegistrarModule {
  const provider = createGriRegistrarProvider(toGriRegistrarConfig(config));
  const getDomainInfo = provider.getDomainInfo;
  if (!getDomainInfo) throw new Error("GRI_DOMAIN_INFO_MISSING");
  return {
    ...provider,
    getDomainInfo,
    async listDomains() {
      const result = await listGriDomains(toGriRegistrarConfig(config));
      if (!result.ok) return { ok: false, provider: result.provider, error: result.error };
      return {
        ok: true,
        provider: result.provider,
        data: (result.data ?? []).map((item) => ({
          domain: item.domain,
          expiresAt: item.expiresAt,
          status: item.status,
          nameservers: item.nameservers,
          autoRenew: item.autoRenew,
        })),
      };
    },
  };
}

export const griModule = defineModule({
  id: "gri",
  kind: "registrar",
  name: "Gri",
  description: "Gri (gri.net) alan adı kayıt, yenileme, transfer ve durum senkronu.",
  configSchema: griConfigSchema,
  secretFields: ["password", "clientSecret"],
  configFields: {
    username: { label: "Kullanıcı adı" },
    password: { label: "Parola" },
    clientId: { label: "Client ID" },
    clientSecret: { label: "Client secret" },
    apiUrl: { label: "API adresi", hint: "Boş bırakılırsa Gri'nin canlı (test modunda sandbox) adresi kullanılır." },
    testMode: { label: "Test modu (sandbox)" },
  },
  capabilities: [
    "register",
    "renew",
    "transfer",
    "nameservers",
    "dnsRecords",
    "availability",
    "bulkAvailability",
    "domainInfo",
    "tldPricing",
    "listDomains",
  ],
  async healthCheck(instance) {
    const result = await createGriRegistrarProvider(toGriRegistrarConfig(instance.config)).healthCheck();
    return { ok: result.ok, message: result.ok ? "Gri API yanıt verdi." : result.error };
  },
  create: (instance) => createGriModule(instance.config),
});
