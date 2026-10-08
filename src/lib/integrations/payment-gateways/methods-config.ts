/**
 * Which payment methods customers may use, in which order, and which one is
 * preselected. Stored as JSON in the `payment_methods` setting; when that row
 * does not exist yet the value is derived from the legacy single-provider
 * settings (`payment_gateway_provider` + `<gateway>_enabled`), so existing
 * installs keep what they offered until an admin saves the new screen.
 *
 * Pure module (no DB): the loaders live in ./methods.ts.
 */

export const PAYMENT_METHOD_IDS = [
  "kuveytturk",
  "paytr",
  "iyzico",
  "bank_transfer",
  "balance",
  "stripe",
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

export const CARD_GATEWAY_IDS = ["kuveytturk", "paytr", "iyzico", "stripe"] as const;
export type CardGatewayId = (typeof CARD_GATEWAY_IDS)[number];

export const PAYMENT_METHODS_SETTING_KEY = "payment_methods";

export interface PaymentMethodsSettings {
  /** Every known method, in display order. */
  order: PaymentMethodId[];
  enabled: PaymentMethodId[];
  defaultMethod: PaymentMethodId;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodId, string> = {
  kuveytturk: "Kuveyt Türk Sanal POS",
  paytr: "PayTR",
  iyzico: "iyzico",
  bank_transfer: "Havale / EFT",
  balance: "Hesap bakiyesi",
  stripe: "Stripe",
};

export function isPaymentMethodId(value: unknown): value is PaymentMethodId {
  return typeof value === "string" && (PAYMENT_METHOD_IDS as readonly string[]).includes(value);
}

export function isCardGatewayId(value: unknown): value is CardGatewayId {
  return typeof value === "string" && (CARD_GATEWAY_IDS as readonly string[]).includes(value);
}

/** Keeps known ids once each, then appends any missing id in the default order. */
export function normalizeOrder(order: readonly unknown[]): PaymentMethodId[] {
  const seen = new Set<PaymentMethodId>();
  for (const id of order) {
    if (isPaymentMethodId(id)) seen.add(id);
  }
  for (const id of PAYMENT_METHOD_IDS) seen.add(id);
  return [...seen];
}

export function normalizePaymentMethodsSettings(input: {
  order?: readonly unknown[];
  enabled?: readonly unknown[];
  defaultMethod?: unknown;
}): PaymentMethodsSettings {
  const order = normalizeOrder(input.order ?? []);
  const enabledSet = new Set((input.enabled ?? []).filter(isPaymentMethodId));
  const enabled = order.filter((id) => enabledSet.has(id));
  const defaultMethod =
    isPaymentMethodId(input.defaultMethod) && enabledSet.has(input.defaultMethod)
      ? input.defaultMethod
      : (enabled[0] ?? "kuveytturk");
  return { order, enabled, defaultMethod };
}

export function parsePaymentMethodsSetting(raw: string | null | undefined): PaymentMethodsSettings | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.enabled)) return null;
    return normalizePaymentMethodsSettings({
      order: Array.isArray(parsed.order) ? parsed.order : [],
      enabled: parsed.enabled,
      defaultMethod: parsed.defaultMethod,
    });
  } catch {
    return null;
  }
}

export function serializePaymentMethodsSettings(settings: PaymentMethodsSettings): string {
  return JSON.stringify({
    order: settings.order,
    enabled: settings.enabled,
    defaultMethod: settings.defaultMethod,
  });
}

export interface LegacyPaymentSettings {
  /** Raw `payment_gateway_provider` row value; empty when the row never existed. */
  provider: string;
  iyzicoEnabled: boolean;
  paytrEnabled: boolean;
  kuveytturkEnabled: boolean;
  kuveytturkConfigured: boolean;
}

/**
 * Data migration from the single-provider model. What was on stays on:
 * the active provider, every gateway whose "aktif" switch was on, and havale
 * (always offered before). Stripe only when an admin explicitly chose it —
 * the old implicit `stripe` fallback is dropped. Kuveyt Türk becomes the
 * default only when its credentials are complete; otherwise the previously
 * active provider stays the default.
 */
export function deriveFromLegacySettings(legacy: LegacyPaymentSettings): PaymentMethodsSettings {
  const provider = legacy.provider.trim().toLowerCase();
  const active = isCardGatewayId(provider) ? provider : null;

  const enabled = new Set<PaymentMethodId>(["bank_transfer"]);
  if (active) enabled.add(active);
  if (legacy.iyzicoEnabled) enabled.add("iyzico");
  if (legacy.paytrEnabled) enabled.add("paytr");
  if (legacy.kuveytturkEnabled) enabled.add("kuveytturk");

  let defaultMethod: PaymentMethodId;
  if (legacy.kuveytturkConfigured) {
    enabled.add("kuveytturk");
    defaultMethod = "kuveytturk";
  } else {
    defaultMethod = active ?? "bank_transfer";
  }

  return normalizePaymentMethodsSettings({
    order: [...PAYMENT_METHOD_IDS],
    enabled: [...enabled],
    defaultMethod,
  });
}

export type MethodAvailability = Record<PaymentMethodId, boolean>;

export interface ResolvedPaymentMethods {
  /** Enabled AND configured, in admin order. */
  available: PaymentMethodId[];
  /** The card gateway behind "Kredi / banka kartı" (the default one if it is a card). */
  primaryCard: CardGatewayId | null;
  /** Other enabled card gateways ("Diğer kart ödeme seçenekleri"). */
  otherCards: CardGatewayId[];
  /** Preselected method; always one of `available` when any is available. */
  defaultMethod: PaymentMethodId | null;
}

export function resolvePaymentMethods(
  settings: PaymentMethodsSettings,
  configured: MethodAvailability
): ResolvedPaymentMethods {
  const enabled = new Set(settings.enabled);
  const available = settings.order.filter((id) => enabled.has(id) && configured[id]);
  const cards = available.filter(isCardGatewayId);

  const primaryCard: CardGatewayId | null = isCardGatewayId(settings.defaultMethod) &&
    cards.includes(settings.defaultMethod)
    ? settings.defaultMethod
    : (cards[0] ?? null);

  const defaultMethod = available.includes(settings.defaultMethod)
    ? settings.defaultMethod
    : (primaryCard ?? available[0] ?? null);

  return {
    available,
    primaryCard,
    otherCards: cards.filter((id) => id !== primaryCard),
    defaultMethod,
  };
}

/**
 * Maps what a client posted to a method id. Legacy values from older pages
 * ("CREDIT_CARD", "BANK_TRANSFER", "BALANCE") keep working: a card request
 * goes to the primary card gateway.
 */
export function resolveRequestedMethod(
  requested: unknown,
  resolved: ResolvedPaymentMethods
): PaymentMethodId | null {
  let id: PaymentMethodId | null = null;
  if (requested === "CREDIT_CARD") id = resolved.primaryCard;
  else if (requested === "BANK_TRANSFER") id = "bank_transfer";
  else if (requested === "BALANCE") id = "balance";
  else if (isPaymentMethodId(requested)) id = requested;

  return id && resolved.available.includes(id) ? id : null;
}

/** Payment.method enum value recorded for a method id. */
export function paymentRecordMethod(id: PaymentMethodId): "CREDIT_CARD" | "BANK_TRANSFER" | "BALANCE" {
  if (id === "bank_transfer") return "BANK_TRANSFER";
  if (id === "balance") return "BALANCE";
  return "CREDIT_CARD";
}
