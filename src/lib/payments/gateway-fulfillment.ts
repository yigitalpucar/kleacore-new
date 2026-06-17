import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseGatewayMeta } from "@/lib/integrations/payment-gateways";
import {
  fulfillInvoicePayment,
  notifyInvoicePaymentReceived,
} from "@/lib/payments/fulfillment";

export async function fulfillPaymentsByGatewayReference(
  tx: Prisma.TransactionClient,
  reference: string,
  notes: string
) {
  const payments = await tx.payment.findMany({
    where: {
      transactionId: reference,
      status: "PENDING",
    },
    select: {
      id: true,
      invoiceId: true,
      notes: true,
      status: true,
    },
  });

  if (payments.length === 0) {
    const completed = await tx.payment.count({
      where: {
        transactionId: reference,
        status: "COMPLETED",
      },
    });

    return {
      fulfilled: false,
      skipped: completed > 0,
      invoiceIds: [] as string[],
    };
  }

  const meta = parseGatewayMeta(payments[0]?.notes);
  const invoiceIds = meta?.invoiceIds?.length
    ? meta.invoiceIds
    : payments.map((payment) => payment.invoiceId);

  const customerId = meta?.customerId ?? "gateway";

  for (const invoiceId of invoiceIds) {
    await fulfillInvoicePayment(tx, {
      invoiceId,
      performedBy: customerId,
      paymentReference: reference,
      notes,
    });
  }

  return { fulfilled: true, skipped: false, invoiceIds };
}

export async function fulfillGatewayReference(reference: string, notes: string) {
  const result = await db.$transaction(async (tx) =>
    fulfillPaymentsByGatewayReference(tx, reference, notes)
  );

  if (result.fulfilled) {
    await Promise.allSettled(
      result.invoiceIds.map((invoiceId) => notifyInvoicePaymentReceived(invoiceId))
    );
  }

  return result;
}