/**
 * E-invoice providers, registered as settings-backed manifests: the
 * Uyumsoft/Paraşüt credentials stay in the existing Setting keys and the
 * /yonetim/entegrasyonlar → E-Fatura form (issuing, status sync and the
 * retry screen read them there).
 */
import { z } from "zod";
import { createEInvoiceProvider, getEInvoiceConfig } from "@/lib/integrations/efatura/config";
import type { EInvoiceProviderName } from "@/lib/integrations/efatura/types";
import { defineModule } from "../types";

function eInvoiceManifest(id: Exclude<EInvoiceProviderName, "disabled">, name: string, description: string) {
  return defineModule({
    id,
    kind: "einvoice",
    name,
    description,
    storage: "settings",
    settingsHref: "/yonetim/entegrasyonlar?tab=efatura",
    configSchema: z.object({}),
    secretFields: [],
    capabilities: ["earsiv", "efatura", "cancel", "pdf"],
    async healthCheck() {
      try {
        const result = await createEInvoiceProvider(id, await getEInvoiceConfig()).healthCheck();
        if (result.skipped) return { ok: false, message: "Yapılandırılmamış." };
        return { ok: result.ok, message: result.ok ? result.detail ?? "Bağlantı başarılı." : result.error };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "EINVOICE_HEALTH_FAILED" };
      }
    },
  });
}

export const uyumsoftModule = eInvoiceManifest("uyumsoft", "Uyumsoft", "Resmi e-Fatura / e-Arşiv entegratörü.");
export const parasutModule = eInvoiceManifest("parasut", "Paraşüt", "Paraşüt üzerinden e-Arşiv (opsiyonel).");
