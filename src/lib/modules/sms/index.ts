/**
 * SMS providers, registered as settings-backed manifests (credentials stay in
 * the /yonetim/entegrasyonlar → SMS form). Only the provider selected there
 * is active; the health check reports on that one.
 */
import { z } from "zod";
import { getSmsConfig, getSmsProvider } from "@/lib/integrations/sms";
import type { SmsProviderName } from "@/lib/integrations/sms/types";
import { defineModule } from "../types";

function smsManifest(id: Exclude<SmsProviderName, "disabled">, name: string) {
  return defineModule({
    id,
    kind: "sms",
    name,
    description: `${name} ile SMS bildirimleri.`,
    storage: "settings",
    settingsHref: "/yonetim/entegrasyonlar?tab=sms",
    configSchema: z.object({}),
    secretFields: [],
    capabilities: ["send"],
    async healthCheck() {
      try {
        const config = await getSmsConfig();
        if (!config.enabled || config.provider !== id) return { ok: false, message: "Seçili SMS sağlayıcısı değil." };
        const result = await (await getSmsProvider()).healthCheck();
        if (result.skipped) return { ok: false, message: "Yapılandırılmamış." };
        return { ok: result.ok, message: result.ok ? "Ayarlar geçerli." : result.error };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "SMS_HEALTH_FAILED" };
      }
    },
  });
}

export const netgsmModule = smsManifest("netgsm", "NetGSM");
export const iletiMerkeziModule = smsManifest("iletimerkezi", "İleti Merkezi");
