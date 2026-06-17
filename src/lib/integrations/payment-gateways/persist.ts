import { db } from "@/lib/db";
import type { PaymentContext } from "@/lib/payments/context";
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

export async function persistGatewayCheckout(input: PersistGatewayCheckoutInput) {
  const meta: GatewayMeta = {
    invoiceIds: input.invoiceIds,
    customerId: input.customerId,
    context: input.context,
    provider: input.provider,
  };

  const notes = buildGatewayNotes(input.notesPrefix, meta);

  await db.payment.updateMany({
    where: {
      invoiceId: { in: input.invoiceIds },
      status: "PENDING",
    },
    data: {
      transactionId: input.gatewaySessionId,
      notes,
    },
  });
}