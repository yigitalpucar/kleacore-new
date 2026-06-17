import { getStripe } from "@/lib/stripe";
import { roundMoney } from "@/lib/payments/orchestrator";
import { persistGatewayCheckout } from "../persist";
import type { CheckoutSessionInput, CheckoutSessionResult, PaymentGatewayProvider } from "../types";

export function createStripePaymentGatewayProvider(): PaymentGatewayProvider {
  return {
    name: "stripe",
    async createCheckout(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
      if (input.invoiceIds.length === 0) {
        throw new Error("INVOICE_IDS_REQUIRED");
      }

      if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
        throw new Error("INVALID_PAYMENT_AMOUNT");
      }

      const stripe = getStripe();
      const normalizedAmount = roundMoney(input.totalAmount);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: {
          customerId: input.customerId,
          invoiceIds: input.invoiceIds.join(","),
          paymentContext: input.context,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "try",
              unit_amount: Math.round(normalizedAmount * 100),
              product_data: {
                name: "KLEACORE Ödeme",
                description: input.description,
              },
            },
          },
        ],
      });

      if (!session.url) {
        throw new Error("STRIPE_CHECKOUT_URL_MISSING");
      }

      await persistGatewayCheckout({
        invoiceIds: input.invoiceIds,
        gatewaySessionId: session.id,
        provider: "stripe",
        customerId: input.customerId,
        context: input.context,
        notesPrefix: "Stripe Checkout ödemesi",
      });

      return {
        checkoutUrl: session.url,
        gatewaySessionId: session.id,
        stripeSessionId: session.id,
        amount: normalizedAmount,
        provider: "stripe",
      };
    },
    async healthCheck() {
      try {
        const stripe = getStripe();
        await stripe.balance.retrieve();
        return { ok: true, provider: "stripe", data: { status: "ok" } };
      } catch (error) {
        return {
          ok: false,
          provider: "stripe",
          error: error instanceof Error ? error.message : "STRIPE_HEALTH_CHECK_FAILED",
        };
      }
    },
  };
}