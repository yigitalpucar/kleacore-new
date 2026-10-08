import {
  getPaymentGatewayConfig,
  isIyzicoConfigured,
  isKuveytTurkConfigured,
  isPaytrConfigured,
  isStripeConfigured,
} from "./config";
import { createDisabledPaymentGatewayProvider } from "./providers/disabled";
import { createIyzicoPaymentGatewayProvider } from "./providers/iyzico";
import { createKuveytTurkPaymentGatewayProvider } from "./providers/kuveytturk";
import { createPaytrPaymentGatewayProvider } from "./providers/paytr";
import { createStripePaymentGatewayProvider } from "./providers/stripe";
import type { PaymentGatewayProvider } from "./types";

export async function getPaymentGatewayProvider(): Promise<PaymentGatewayProvider> {
  const config = await getPaymentGatewayConfig();

  if (config.provider === "stripe") {
    if (!isStripeConfigured()) {
      return createDisabledPaymentGatewayProvider("stripe");
    }
    return createStripePaymentGatewayProvider();
  }

  if (config.provider === "kuveytturk") {
    if (!config.kuveytturk.enabled || !isKuveytTurkConfigured(config)) {
      return createDisabledPaymentGatewayProvider("kuveytturk");
    }
    return createKuveytTurkPaymentGatewayProvider(config);
  }

  if (config.provider === "iyzico") {
    if (!config.iyzico.enabled || !isIyzicoConfigured(config)) {
      return createDisabledPaymentGatewayProvider("iyzico");
    }
    return createIyzicoPaymentGatewayProvider(config);
  }

  if (config.provider === "paytr") {
    if (!config.paytr.enabled || !isPaytrConfigured(config)) {
      return createDisabledPaymentGatewayProvider("paytr");
    }
    return createPaytrPaymentGatewayProvider(config);
  }

  if (!isStripeConfigured()) {
    return createDisabledPaymentGatewayProvider("stripe");
  }

  return createStripePaymentGatewayProvider();
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