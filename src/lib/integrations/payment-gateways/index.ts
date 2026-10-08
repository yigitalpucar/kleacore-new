import {
  getPaymentGatewayConfig,
  getPrimaryCardGateway,
  isCardGatewayUsable,
  type PaymentGatewayConfig,
} from "./config";
import type { CardGatewayId } from "./methods-config";
import { createDisabledPaymentGatewayProvider } from "./providers/disabled";
import { createIyzicoPaymentGatewayProvider } from "./providers/iyzico";
import { createKuveytTurkPaymentGatewayProvider } from "./providers/kuveytturk";
import { createPaytrPaymentGatewayProvider } from "./providers/paytr";
import { createStripePaymentGatewayProvider } from "./providers/stripe";
import type { PaymentGatewayProvider } from "./types";

export function createCardGatewayProvider(
  config: PaymentGatewayConfig,
  id: CardGatewayId
): PaymentGatewayProvider {
  if (!isCardGatewayUsable(config, id)) {
    return createDisabledPaymentGatewayProvider(id);
  }
  switch (id) {
    case "kuveytturk":
      return createKuveytTurkPaymentGatewayProvider(config);
    case "iyzico":
      return createIyzicoPaymentGatewayProvider(config);
    case "paytr":
      return createPaytrPaymentGatewayProvider(config);
    case "stripe":
      return createStripePaymentGatewayProvider();
  }
}

/**
 * Card gateway for a payment. Without an id it is the primary card gateway
 * (the default card method — Kuveyt Türk on a configured install); with an id
 * the customer picked one of the other enabled card options. A gateway that is
 * switched off or missing credentials yields the "disabled" provider.
 */
export async function getPaymentGatewayProvider(id?: CardGatewayId): Promise<PaymentGatewayProvider> {
  const config = await getPaymentGatewayConfig();
  const target = id ?? getPrimaryCardGateway(config);
  if (!target) {
    return createDisabledPaymentGatewayProvider("disabled");
  }
  return createCardGatewayProvider(config, target);
}

export type {
  CheckoutSessionInput,
  CheckoutSessionResult,
  GatewayMeta,
  PaymentGatewayId,
  PaymentGatewayProvider,
} from "./types";
export { parseGatewayMeta } from "./gateway-meta";
export { getPaymentGatewayConfig } from "./config";
