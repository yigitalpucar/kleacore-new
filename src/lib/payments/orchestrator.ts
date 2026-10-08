import { db } from "@/lib/db";
import { getPaymentGatewayProvider } from "@/lib/integrations/payment-gateways";
import type { CheckoutCustomerInfo } from "@/lib/integrations/payment-gateways/types";
import type { CardGatewayId } from "@/lib/integrations/payment-gateways/methods-config";
import { getAppBaseUrl } from "@/lib/stripe";
import type { PaymentContext } from "@/lib/payments/context";
import type { CustomerPaymentMethod } from "@/lib/payments/methods";
import { toNumber, type MoneyInput } from "@/lib/money";

export type { PaymentContext } from "@/lib/payments/context";

/** Customer fields the card gateways need (billing info for 3-D Secure). */
export async function loadCheckoutCustomer(
  customerId: string,
  ip?: string
): Promise<CheckoutCustomerInfo> {
  const customer = await db.user.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      email: true,
      name: true,
      surname: true,
      phone: true,
      address: true,
      city: true,
      country: true,
      taxNumber: true,
    },
  });

  if (!customer) {
    throw new Error("CUSTOMER_NOT_FOUND");
  }

  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    surname: customer.surname,
    phone: customer.phone,
    address: customer.address,
    city: customer.city,
    country: customer.country,
    identityNumber: customer.taxNumber,
    ip,
  };
}

interface CreateStripeCheckoutInput {
  customerId: string;
  invoiceIds: string[];
  totalAmount: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
  context: PaymentContext;
}

/** Kuruş-rounded number (half-up). Prefer the helpers in `@/lib/money` for new code. */
export function roundMoney(value: MoneyInput): number {
  return toNumber(value);
}

/** @deprecated Use getPaymentGatewayProvider().createCheckout() */
export async function createStripeCheckoutForInvoices(input: CreateStripeCheckoutInput) {
  const provider = await getPaymentGatewayProvider();
  const customer = await loadCheckoutCustomer(input.customerId);

  const result = await provider.createCheckout({
    customerId: input.customerId,
    customer,
    invoiceIds: input.invoiceIds,
    totalAmount: input.totalAmount,
    description: input.description,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    context: input.context,
  });

  return {
    checkoutUrl: result.checkoutUrl,
    checkoutHtml: result.checkoutHtml,
    paytrToken: result.paytrToken,
    stripeSessionId: result.stripeSessionId ?? result.gatewaySessionId,
    gatewaySessionId: result.gatewaySessionId,
    amount: result.amount,
    provider: result.provider,
  };
}

interface InitiateCreditCardPaymentInput {
  customerId: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  context: PaymentContext;
  customerIp?: string;
  /** Card gateway the customer picked; the primary card gateway when omitted. */
  gateway?: CardGatewayId;
}

export async function initiateCreditCardPayment(input: InitiateCreditCardPaymentInput) {
  const baseUrl = getAppBaseUrl();

  const successUrl =
    input.context === "panel_renewal"
      ? `${baseUrl}/musteri/panel/hizmetlerim?renewal=success`
      : `${baseUrl}/musteri/panel/faturalar/${input.invoiceId}?payment=success`;

  const cancelUrl =
    input.context === "panel_renewal"
      ? `${baseUrl}/musteri/panel/hizmetlerim?renewal=cancelled`
      : `${baseUrl}/musteri/panel/faturalar/${input.invoiceId}?payment=cancelled`;

  const customer = await loadCheckoutCustomer(input.customerId, input.customerIp);

  const provider = await getPaymentGatewayProvider(input.gateway);
  const result = await provider.createCheckout({
    customerId: input.customerId,
    customer,
    invoiceIds: [input.invoiceId],
    totalAmount: input.amount,
    description: `${input.invoiceNumber} fatura ödemesi`,
    successUrl,
    cancelUrl,
    context: input.context,
  });

  return {
    checkoutUrl: result.checkoutUrl,
    checkoutHtml: result.checkoutHtml,
    paytrToken: result.paytrToken,
    stripeSessionId: result.stripeSessionId ?? result.gatewaySessionId,
    gatewaySessionId: result.gatewaySessionId,
    amount: result.amount,
    provider: result.provider,
  };
}

export function isStripePaymentMethod(method: CustomerPaymentMethod) {
  return method === "CREDIT_CARD";
}