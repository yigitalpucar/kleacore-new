import { getSettingMap, isEnabled } from "@/lib/integrations/settings";
import type { PaymentGatewayId } from "./types";

export interface PaymentGatewayConfig {
  provider: PaymentGatewayId;
  iyzico: {
    enabled: boolean;
    apiKey: string;
    secretKey: string;
    testMode: boolean;
  };
  paytr: {
    enabled: boolean;
    merchantId: string;
    merchantKey: string;
    merchantSalt: string;
  };
}

export async function getPaymentGatewayConfig(): Promise<PaymentGatewayConfig> {
  const settings = await getSettingMap([
    { key: "payment_gateway_provider", fallback: "stripe" },
    { key: "iyzico_enabled", env: "IYZICO_ENABLED", fallback: "false" },
    { key: "iyzico_api_key", env: "IYZICO_API_KEY" },
    { key: "iyzico_secret_key", env: "IYZICO_SECRET_KEY" },
    { key: "iyzico_test_mode", env: "IYZICO_TEST_MODE", fallback: "true" },
    { key: "paytr_enabled", env: "PAYTR_ENABLED", fallback: "false" },
    { key: "paytr_merchant_id", env: "PAYTR_MERCHANT_ID" },
    { key: "paytr_merchant_key", env: "PAYTR_MERCHANT_KEY" },
    { key: "paytr_merchant_salt", env: "PAYTR_MERCHANT_SALT" },
  ]);

  const provider = normalizeProvider(settings.payment_gateway_provider);

  return {
    provider,
    iyzico: {
      enabled: isEnabled(settings.iyzico_enabled),
      apiKey: settings.iyzico_api_key,
      secretKey: settings.iyzico_secret_key,
      testMode: isEnabled(settings.iyzico_test_mode),
    },
    paytr: {
      enabled: isEnabled(settings.paytr_enabled),
      merchantId: settings.paytr_merchant_id,
      merchantKey: settings.paytr_merchant_key,
      merchantSalt: settings.paytr_merchant_salt,
    },
  };
}

function normalizeProvider(value: string): PaymentGatewayId {
  const normalized = value.trim().toLowerCase();
  if (normalized === "iyzico" || normalized === "paytr" || normalized === "stripe") {
    return normalized;
  }
  return "stripe";
}

export function isIyzicoConfigured(config: PaymentGatewayConfig) {
  return Boolean(config.iyzico.apiKey && config.iyzico.secretKey);
}

export function isPaytrConfigured(config: PaymentGatewayConfig) {
  return Boolean(
    config.paytr.merchantId && config.paytr.merchantKey && config.paytr.merchantSalt
  );
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}