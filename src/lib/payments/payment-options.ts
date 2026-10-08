import { db } from "@/lib/db";
import {
  getPaymentGatewayConfig,
  isCardGatewayConfigured,
} from "@/lib/integrations/payment-gateways/config";
import {
  isCardGatewayId,
  resolvePaymentMethods,
  resolveRequestedMethod,
  type MethodAvailability,
  type PaymentMethodId,
  type ResolvedPaymentMethods,
} from "@/lib/integrations/payment-gateways/methods-config";
import { toNumber } from "@/lib/money";

/** One radio card in the payment method picker (plain data for client components). */
export interface PaymentOption {
  id: PaymentMethodId;
  kind: "card" | "bank_transfer" | "balance";
  label: string;
  description: string;
}

export interface CustomerPaymentOptions {
  /** Main choices in admin order: the primary card gateway, havale, bakiye. */
  options: PaymentOption[];
  /** "Diğer kart ödeme seçenekleri": the remaining enabled card gateways. */
  otherCards: PaymentOption[];
  defaultMethod: PaymentMethodId | null;
  /** Customer balance in TRY when the balance method is offered. */
  balance: number | null;
}

const OTHER_CARD_COPY: Record<string, { label: string; description: string }> = {
  kuveytturk: { label: "Kuveyt Türk ile kartla öde", description: "3D Secure ile tek çekim." },
  paytr: { label: "PayTR ile kartla öde", description: "PayTR güvenli ödeme sayfasında kart bilgilerinizi girersiniz." },
  iyzico: { label: "iyzico ile kartla öde", description: "iyzico ödeme formunda taksit seçenekleri sunulabilir." },
  stripe: { label: "Stripe ile kartla öde", description: "Yurt dışı kartlar için Stripe ödeme sayfası." },
};

export function buildPaymentOptions(
  resolved: ResolvedPaymentMethods,
  balance: number | null
): Omit<CustomerPaymentOptions, "balance"> {
  const options: PaymentOption[] = [];
  for (const id of resolved.available) {
    if (id === resolved.primaryCard) {
      options.push({
        id,
        kind: "card",
        label: "Kredi / banka kartı",
        description: "Visa, Mastercard, Troy · 3D Secure ile güvenli ödeme.",
      });
    } else if (id === "bank_transfer") {
      options.push({
        id,
        kind: "bank_transfer",
        label: "Havale / EFT",
        description: "Banka hesabımıza gönderin; ödeme bildiriminiz onaylanınca faturanız kapanır.",
      });
    } else if (id === "balance") {
      options.push({
        id,
        kind: "balance",
        label: "Hesap bakiyesi",
        description:
          balance === null
            ? "Ödeme hesap bakiyenizden düşülür."
            : `Kullanılabilir bakiye: ${balance.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}`,
      });
    }
  }

  const otherCards: PaymentOption[] = resolved.otherCards.map((id) => ({
    id,
    kind: "card",
    ...OTHER_CARD_COPY[id],
  }));

  return { options, otherCards, defaultMethod: resolved.defaultMethod };
}

/** Enabled AND configured methods, resolved against the current settings. */
export async function getResolvedPaymentMethods(): Promise<ResolvedPaymentMethods> {
  const config = await getPaymentGatewayConfig();
  const activeBankAccounts = await db.bankAccount.count({ where: { isActive: true } });

  const availability: MethodAvailability = {
    kuveytturk: isCardGatewayConfigured(config, "kuveytturk"),
    paytr: isCardGatewayConfigured(config, "paytr"),
    iyzico: isCardGatewayConfigured(config, "iyzico"),
    stripe: isCardGatewayConfigured(config, "stripe"),
    // Havale needs somewhere to send the money.
    bank_transfer: activeBankAccounts > 0,
    balance: true,
  };

  return resolvePaymentMethods(config.methods, availability);
}

/**
 * Picker data for a customer. Balance is offered only to a signed-in customer
 * who has some; guests and empty balances don't see it.
 */
export async function getCustomerPaymentOptions(customerId?: string | null): Promise<CustomerPaymentOptions> {
  let resolved = await getResolvedPaymentMethods();

  let balance: number | null = null;
  if (resolved.available.includes("balance") && customerId) {
    const customer = await db.user.findUnique({ where: { id: customerId }, select: { balance: true } });
    balance = customer ? toNumber(customer.balance) : null;
  }
  if (balance === null || balance <= 0) {
    resolved = withoutMethod(resolved, "balance");
    balance = null;
  }

  return { ...buildPaymentOptions(resolved, balance), balance };
}

export function withoutMethod(resolved: ResolvedPaymentMethods, id: PaymentMethodId): ResolvedPaymentMethods {
  const available = resolved.available.filter((candidate) => candidate !== id);
  return {
    ...resolved,
    available,
    defaultMethod:
      resolved.defaultMethod === id ? (resolved.primaryCard ?? available[0] ?? null) : resolved.defaultMethod,
  };
}

/** Validates a posted method against what is offered right now. */
export async function resolveCustomerPaymentMethod(requested: unknown) {
  const resolved = await getResolvedPaymentMethods();
  const id = resolveRequestedMethod(requested, resolved);
  return { id, cardGateway: id && isCardGatewayId(id) ? id : null, resolved };
}
