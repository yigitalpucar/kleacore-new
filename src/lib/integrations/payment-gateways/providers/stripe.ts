import { getStripe } from "@/lib/stripe";
import { toKurus, toNumber } from "@/lib/money";
import { persistGatewayCheckout } from "../persist";
import type {
  CheckoutSessionInput,
  CheckoutSessionResult,
  GatewayRefundResult,
  PaymentGatewayProvider,
} from "../types";

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
      const normalizedAmount = toNumber(input.totalAmount);

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
              unit_amount: toKurus(normalizedAmount),
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
/** Refunds (part of) the PaymentIntent behind a Checkout Session. */
export async function refundStripePayment(input: {
  sessionId: string;
  amountKurus: number;
  idempotencyKey: string;
}): Promise<GatewayRefundResult> {
  const stripe = getStripe();
  let paymentIntent: string | undefined;
  try {
    const session = await stripe.checkout.sessions.retrieve(input.sessionId);
    paymentIntent =
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  } catch {
    return { ok: false, message: "Stripe ödeme oturumu okunamadı; iade yapılmadı." };
  }
  if (!paymentIntent) {
    return { ok: false, message: "Stripe ödeme oturumunda tahsilat bulunamadı." };
  }

  try {
    const refund = await stripe.refunds.create(
      { payment_intent: paymentIntent, amount: input.amountKurus },
      { idempotencyKey: `kleacore-refund-${input.idempotencyKey}` }
    );
    const ok = refund.status === "succeeded" || refund.status === "pending";
    return {
      ok,
      operation: "refund",
      gatewayRef: refund.id,
      message: ok ? "Stripe iadeyi kabul etti." : `Stripe iade durumu: ${refund.status}`,
      data: { paymentIntent, status: refund.status },
    };
  } catch {
    return {
      ok: false,
      uncertain: true,
      operation: "refund",
      message: "Stripe'a ulaşılamadı; iade durumu Stripe panelinden kontrol edilmeli.",
    };
  }
}
