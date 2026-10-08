import { getSettingMap, isEnabled } from "@/lib/integrations/settings";
import {
  CARD_GATEWAY_IDS,
  PAYMENT_METHODS_SETTING_KEY,
  deriveFromLegacySettings,
  parsePaymentMethodsSetting,
  type CardGatewayId,
  type PaymentMethodsSettings,
} from "./methods-config";
import type { PaymentGatewayId } from "./types";

export interface PaymentGatewayConfig {
  /**
   * Primary card gateway (default card method that is enabled and
   * configured), or "disabled" when no card gateway can take payments.
   */
  provider: PaymentGatewayId;
  /** Enabled methods, order and default (see methods-config.ts). */
  methods: PaymentMethodsSettings;
  /** True when `methods` came from the legacy single-provider settings. */
  methodsDerived: boolean;
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
  kuveytturk: {
    enabled: boolean;
    merchantId: string;
    customerId: string;
    username: string;
    password: string;
    testMode: boolean;
  };
}

export async function getPaymentGatewayConfig(): Promise<PaymentGatewayConfig> {
  const settings = await getSettingMap([
    { key: PAYMENT_METHODS_SETTING_KEY },
    { key: "payment_gateway_provider" },
    { key: "iyzico_enabled", env: "IYZICO_ENABLED", fallback: "false" },
    { key: "iyzico_api_key", env: "IYZICO_API_KEY" },
    { key: "iyzico_secret_key", env: "IYZICO_SECRET_KEY" },
    { key: "iyzico_test_mode", env: "IYZICO_TEST_MODE", fallback: "true" },
    { key: "paytr_enabled", env: "PAYTR_ENABLED", fallback: "false" },
    { key: "paytr_merchant_id", env: "PAYTR_MERCHANT_ID" },
    { key: "paytr_merchant_key", env: "PAYTR_MERCHANT_KEY" },
    { key: "paytr_merchant_salt", env: "PAYTR_MERCHANT_SALT" },
    { key: "kuveytturk_enabled", env: "KUVEYTTURK_ENABLED", fallback: "false" },
    { key: "kuveytturk_merchant_id", env: "KUVEYTTURK_MERCHANT_ID" },
    { key: "kuveytturk_customer_id", env: "KUVEYTTURK_CUSTOMER_ID" },
    { key: "kuveytturk_username", env: "KUVEYTTURK_USERNAME" },
    { key: "kuveytturk_password", env: "KUVEYTTURK_PASSWORD" },
    { key: "kuveytturk_test_mode", env: "KUVEYTTURK_TEST_MODE", fallback: "true" },
  ]);

  const stored = parsePaymentMethodsSetting(settings[PAYMENT_METHODS_SETTING_KEY]);
  const kuveytturkConfigured = Boolean(
    settings.kuveytturk_merchant_id.trim() &&
      settings.kuveytturk_customer_id.trim() &&
      settings.kuveytturk_username.trim() &&
      settings.kuveytturk_password
  );
  const methods =
    stored ??
    deriveFromLegacySettings({
      provider: settings.payment_gateway_provider,
      iyzicoEnabled: isEnabled(settings.iyzico_enabled),
      paytrEnabled: isEnabled(settings.paytr_enabled),
      kuveytturkEnabled: isEnabled(settings.kuveytturk_enabled),
      kuveytturkConfigured,
    });
  // The method list is the single switch; the per-gateway flags mirror it so
  // callbacks and the Kuveyt Türk card form keep their own checks.
  const enabled = new Set(methods.enabled);

  const config: PaymentGatewayConfig = {
    provider: "disabled",
    methods,
    methodsDerived: stored === null,
    iyzico: {
      enabled: enabled.has("iyzico"),
      apiKey: settings.iyzico_api_key,
      secretKey: settings.iyzico_secret_key,
      testMode: isEnabled(settings.iyzico_test_mode),
    },
    paytr: {
      enabled: enabled.has("paytr"),
      merchantId: settings.paytr_merchant_id,
      merchantKey: settings.paytr_merchant_key,
      merchantSalt: settings.paytr_merchant_salt,
    },
    kuveytturk: {
      enabled: enabled.has("kuveytturk"),
      merchantId: settings.kuveytturk_merchant_id.trim(),
      customerId: settings.kuveytturk_customer_id.trim(),
      username: settings.kuveytturk_username.trim(),
      password: settings.kuveytturk_password,
      testMode: isEnabled(settings.kuveytturk_test_mode),
    },
  };
  config.provider = getPrimaryCardGateway(config) ?? "disabled";
  return config;
}

/** Credentials are complete for this card gateway. */
export function isCardGatewayConfigured(config: PaymentGatewayConfig, id: CardGatewayId) {
  switch (id) {
    case "kuveytturk":
      return isKuveytTurkConfigured(config);
    case "paytr":
      return isPaytrConfigured(config);
    case "iyzico":
      return isIyzicoConfigured(config);
    case "stripe":
      return isStripeConfigured();
  }
}

/** Enabled in the method list and configured — may take a payment now. */
export function isCardGatewayUsable(config: PaymentGatewayConfig, id: CardGatewayId) {
  return config.methods.enabled.includes(id) && isCardGatewayConfigured(config, id);
}

/** The default method if it is a usable card gateway, else the first usable one in order. */
export function getPrimaryCardGateway(config: PaymentGatewayConfig): CardGatewayId | null {
  const usable = config.methods.order.filter(
    (id): id is CardGatewayId =>
      (CARD_GATEWAY_IDS as readonly string[]).includes(id) && isCardGatewayUsable(config, id as CardGatewayId)
  );
  const preferred = config.methods.defaultMethod;
  return usable.find((id) => id === preferred) ?? usable[0] ?? null;
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
export function isKuveytTurkConfigured(config: PaymentGatewayConfig) {
  const { merchantId, customerId, username, password } = config.kuveytturk;
  return Boolean(merchantId && customerId && username && password);
}
