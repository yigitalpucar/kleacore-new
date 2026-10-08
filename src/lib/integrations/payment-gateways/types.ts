import type { IntegrationResult } from "@/lib/integrations/settings";
import type { PaymentContext } from "@/lib/payments/context";

export type PaymentGatewayId = "stripe" | "iyzico" | "paytr" | "kuveytturk" | "disabled";

export interface CheckoutCustomerInfo {
  id: string;
  email: string;
  name: string;
  surname: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  identityNumber?: string | null;
  ip?: string;
}

export interface CheckoutSessionInput {
  customerId: string;
  customer: CheckoutCustomerInfo;
  invoiceIds: string[];
  totalAmount: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
  context: PaymentContext;
}

export interface CheckoutSessionResult {
  checkoutUrl?: string;
  checkoutHtml?: string;
  paytrToken?: string;
  gatewaySessionId: string;
  amount: number;
  provider: PaymentGatewayId;
  stripeSessionId?: string;
}

export interface PaymentGatewayProvider {
  name: PaymentGatewayId;
  createCheckout(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;
  healthCheck(): Promise<IntegrationResult>;
}

export interface GatewayMeta {
  invoiceIds: string[];
  customerId: string;
  context: PaymentContext;
  provider: PaymentGatewayId;
}