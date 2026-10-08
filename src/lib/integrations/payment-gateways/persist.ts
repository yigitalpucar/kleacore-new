import { db } from "@/lib/db";
import type { PaymentContext } from "@/lib/payments/context";
import { max, sub } from "@/lib/money";
import { buildGatewayNotes } from "./gateway-meta";
import type { GatewayMeta, PaymentGatewayId } from "./types";

interface PersistGatewayCheckoutInput {
  invoiceIds: string[];
  gatewaySessionId: string;
  provider: PaymentGatewayId;
  customerId: string;
  context: PaymentContext;
  notesPrefix: string;
}

/**
 * Binds a gateway session to exactly one PENDING card payment per invoice.
 *
 * A customer can open several checkouts for the same invoice (closed tab,
 * retried, switched gateway). Each session gets its own Payment row, so the
 * callback of whichever session is actually paid still finds its payment —
 * earlier sessions are never overwritten.
 */
export async function persistGatewayCheckout(input: PersistGatewayCheckoutInput) {
  const meta: GatewayMeta = {
    invoiceIds: input.invoiceIds,
    customerId: input.customerId,
    context: input.context,
    provider: input.provider,
  };

  const notes = buildGatewayNotes(input.notesPrefix, meta);

  await db.$transaction(async (tx) => {
    for (const invoiceId of input.invoiceIds) {
      const unassigned = await tx.payment.findFirst({
        where: {
          invoiceId,
          status: "PENDING",
          method: "CREDIT_CARD",
          transactionId: null,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      if (unassigned) {
        await tx.payment.update({
          where: { id: unassigned.id },
          data: { transactionId: input.gatewaySessionId, notes },
        });
        continue;
      }

      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: { customerId: true, totalAmount: true, paidAmount: true },
      });

      if (!invoice) {
        throw new Error("INVOICE_NOT_FOUND");
      }

      await tx.payment.upsert({
        where: {
          invoiceId_transactionId: {
            invoiceId,
            transactionId: input.gatewaySessionId,
          },
        },
        update: { notes },
        create: {
          invoiceId,
          customerId: invoice.customerId,
          amount: max(0, sub(invoice.totalAmount, invoice.paidAmount)),
          method: "CREDIT_CARD",
          status: "PENDING",
          transactionId: input.gatewaySessionId,
          notes,
        },
      });
    }
  });
}
