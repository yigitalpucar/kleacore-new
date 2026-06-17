import { db } from "@/lib/db";
import { getPaymentGatewayProvider } from "@/lib/integrations/payment-gateways";
import { getAppBaseUrl } from "@/lib/stripe";
import type { PaymentContext } from "@/lib/payments/context";
import type { CustomerPaymentMethod } from "@/lib/payments/methods";

export type { PaymentContext } from "@/lib/payments/context";

interface CreateStripeCheckoutInput {
  customerId: string;
  invoiceIds: string[];
  totalAmount: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
  context: PaymentContext;
}

export function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

/** @deprecated Use getPaymentGatewayProvider().createCheckout() */
export async function createStripeCheckoutForInvoices(input: CreateStripeCheckoutInput) {
  const provider = await getPaymentGatewayProvider();
  const customer = await db.user.findUnique({
    where: { id: input.customerId },
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

  const result = await provider.createCheckout({
    customerId: input.customerId,
    customer: {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      surname: customer.surname,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      country: customer.country,
      identityNumber: customer.taxNumber,
    },
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

  const customer = await db.user.findUnique({
    where: { id: input.customerId },
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

  const provider = await getPaymentGatewayProvider();
  const result = await provider.createCheckout({
    customerId: input.customerId,
    customer: {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      surname: customer.surname,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      country: customer.country,
      identityNumber: customer.taxNumber,
      ip: input.customerIp,
    },
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