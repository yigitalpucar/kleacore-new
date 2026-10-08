/**
 * Virtualizor (frozen, hidden): registered only so a legacy Virtualizor
 * configuration can be mirrored as an instance. Not offered for new
 * instances; Proxmox replaces it (Faz 2.3).
 */
import { z } from "zod";
import { createVirtualizorProvider } from "@/lib/integrations/provisioning/providers/virtualizor";
import type { VpsVdsConfig } from "@/lib/integrations/provisioning/types";
import { serverModuleFromProvisioningProvider } from "../legacy-adapter";
import { defineModule } from "../../types";

export const virtualizorConfigSchema = z.object({
  apiUrl: z.string().trim().url(),
  apiKey: z.string().min(1),
  apiPassword: z.string().min(1),
});

export type VirtualizorModuleConfig = z.infer<typeof virtualizorConfigSchema>;

export function toVirtualizorConfig(config: VirtualizorModuleConfig): VpsVdsConfig {
  return { enabled: true, provider: "virtualizor", apiUsername: "", ...config };
}

export const virtualizorModule = defineModule({
  id: "virtualizor",
  kind: "server",
  name: "Virtualizor",
  description: "Eski VPS paneli entegrasyonu (donduruldu). Yeni kurulumlar için Proxmox kullanın.",
  hidden: true,
  configSchema: virtualizorConfigSchema,
  secretFields: ["apiKey", "apiPassword"],
  configFields: {
    apiUrl: { label: "API adresi" },
    apiKey: { label: "API anahtarı" },
    apiPassword: { label: "API parolası" },
  },
  capabilities: ["provision", "changePackage", "power"],
  productCategories: ["vps", "vds", "cloud", "server"],
  productOptionsSchema: z.object({}),
  async healthCheck(instance) {
    const result = await createVirtualizorProvider(toVirtualizorConfig(instance.config)).healthCheck();
    return { ok: result.ok, message: result.ok ? "Virtualizor yanıt verdi." : result.error };
  },
  create: (instance) =>
    serverModuleFromProvisioningProvider("virtualizor", createVirtualizorProvider(toVirtualizorConfig(instance.config))),
});
