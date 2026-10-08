/**
 * Payment gateways, registered as settings-backed manifests: their
 * credentials stay in the existing Setting keys and forms
 * (/yonetim/entegrasyonlar → Ödeme) because checkout, callbacks and refunds
 * read them there and multi-active methods already work (payment_methods).
 * Moving them to ModuleInstance rows is a later, separate step.
 */
import { z } from "zod";
import { createCardGatewayProvider } from "@/lib/integrations/payment-gateways";
import { getPaymentGatewayConfig } from "@/lib/integrations/payment-gateways/config";
import type { CardGatewayId } from "@/lib/integrations/payment-gateways/methods-config";
import { defineModule } from "../types";

const SETTINGS_HREF = "/yonetim/entegrasyonlar?tab=payment";

function cardGatewayManifest(
  id: CardGatewayId,
  name: string,
  description: string,
  capabilities: Array<"checkout" | "refund" | "installments">,
  hidden = false
) {
  return defineModule({
    id,
    kind: "payment",
    name,
    description,
    hidden,
    storage: "settings",
    settingsHref: SETTINGS_HREF,
    configSchema: z.object({}),
    secretFields: [],
    capabilities,
    async healthCheck() {
      try {
        const provider = createCardGatewayProvider(await getPaymentGatewayConfig(), id);
        const result = await provider.healthCheck();
        if (result.skipped) return { ok: false, message: "Yapılandırılmamış veya kapalı." };
        return { ok: result.ok, message: result.ok ? "Ayarlar geçerli." : result.error };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "PAYMENT_HEALTH_FAILED" };
      }
    },
  });
}

export const kuveytTurkModule = cardGatewayManifest(
  "kuveytturk",
  "Kuveyt Türk Sanal POS",
  "3D Secure kart ödemesi (birincil sanal POS).",
  ["checkout", "refund"]
);
export const paytrModule = cardGatewayManifest("paytr", "PayTR", "PayTR iFrame ile kart ödemesi.", ["checkout", "refund", "installments"]);
export const iyzicoModule = cardGatewayManifest("iyzico", "iyzico", "iyzico Checkout Form ile kart ödemesi.", ["checkout", "refund", "installments"]);
export const stripeModule = cardGatewayManifest("stripe", "Stripe", "Eski Stripe Checkout entegrasyonu (donduruldu).", ["checkout"], true);
