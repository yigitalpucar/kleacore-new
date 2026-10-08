import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fulfillBalanceTopUp } from "@/lib/payments/balance-top-up";
import {
  finalizeFulfilledInvoices,
  fulfillInvoicePayment,
  type FulfillInvoicePaymentResult,
} from "@/lib/payments/fulfillment";
import { getStripe } from "@/lib/stripe";
import { createLogger } from "@/lib/logger";

const log = createLogger("payments.stripe");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseInvoiceIds(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 400 });
  }

  const stripe = getStripe();
  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    log.warn("stripe webhook signature verification failed", { error });
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  const existingEvent = await db.stripeWebhookEvent.findUnique({
    where: { eventId: event.id },
  });

  if (existingEvent) {
    return NextResponse.json({ received: true, skipped: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    if (session.metadata?.type === "balance_top_up") {
      const customerId = session.metadata.customerId?.trim();
      const amount = Number(session.metadata.amount);

      if (!customerId || !Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "Missing balance top-up metadata" }, { status: 400 });
      }

      try {
        await db.$transaction(async (tx) => {
          await tx.stripeWebhookEvent.create({
            data: { eventId: event.id },
          });

          await fulfillBalanceTopUp(tx, {
            customerId,
            amount,
            paymentReference: session.id,
          });
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return NextResponse.json({ received: true, skipped: true });
        }
        throw error;
      }
    } else {
      const invoiceIds = parseInvoiceIds(session.metadata?.invoiceIds);
      if (invoiceIds.length === 0) {
        return NextResponse.json({ error: "Missing invoice metadata" }, { status: 400 });
      }

      try {
        const results = await db.$transaction(async (tx) => {
          await tx.stripeWebhookEvent.create({
            data: { eventId: event.id },
          });

          const settled: FulfillInvoicePaymentResult[] = [];
          for (const invoiceId of invoiceIds) {
            settled.push(
              await fulfillInvoicePayment(tx, {
                invoiceId,
                performedBy: session.metadata?.customerId ?? "stripe",
                paymentReference: session.id,
                notes: "Stripe Checkout ödemesi",
              })
            );
          }
          return settled;
        });

        await finalizeFulfilledInvoices(results);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return NextResponse.json({ received: true, skipped: true });
        }
        throw error;
      }
    }
  } else {
    await db.stripeWebhookEvent.create({
      data: { eventId: event.id },
    });
  }

  return NextResponse.json({ received: true });
}