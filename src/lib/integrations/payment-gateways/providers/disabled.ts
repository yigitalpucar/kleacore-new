import { disabledResult } from "@/lib/integrations/helpers";
import type { PaymentGatewayProvider } from "../types";

const NOT_CONFIGURED = "PAYMENT_GATEWAY_NOT_CONFIGURED";

export function createDisabledPaymentGatewayProvider(
  provider: "disabled" | "iyzico" | "paytr" | "stripe" | "kuveytturk" = "disabled"
): PaymentGatewayProvider {
  return {
    name: "disabled",
    createCheckout: async () => {
      throw new Error(NOT_CONFIGURED);
    },
    healthCheck: async () => disabledResult(provider, NOT_CONFIGURED),
  };
}