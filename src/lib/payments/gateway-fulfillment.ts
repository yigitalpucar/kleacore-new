import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseGatewayMeta } from "@/lib/integrations/payment-gateways";
import {
  fulfillInvoicePayment,
  notifyInvoicePaymentReceived,
} from "@/lib/payments/fulfillment";
import { runUnsuspendJobsForInvoices } from "@/lib/payments/service-lifecycle";
import { sum, toFixed2, toKurus, type MoneyInput } from "@/lib/money";

/** What the gateway says was charged for a session, as reported in its callback. */
export interface GatewayPaymentConfirmation {
  /** Amount actually charged in TRY (PayTR `total_amount`, iyzico `paidPrice`). May include installment fees. */
  paidAmount?: number;
  /** Amount of the original request when reported separately (PayTR `payment_amount`, iyzico `price`). */
  requestedAmount?: number;
  /** Currency code reported by the gateway (TRY / TL). */
  currency?: string;
}

const ACCEPTED_CURRENCIES = new Set(["TRY", "TL"]);

/**
 * Compares the gateway-reported amount with what we expected to collect for
 * the session, in kuruş so float noise (0.1 + 0.2) never causes a mismatch.
 * The requested amount must match exactly; the charged amount may exceed it
 * (installment surcharge paid by the customer) but never fall short.
 */
export function verifyGatewayAmount(
  expectedAmount: MoneyInput,
  confirmation: GatewayPaymentConfirmation | undefined
): { ok: true } | { ok: false; reason: string } {
  if (!confirmation) {
    return { ok: true };
  }

  const expected = toKurus(expectedAmount);

  if (
    confirmation.currency &&
    !ACCEPTED_CURRENCIES.has(confirmation.currency.trim().toUpperCase())
  ) {
    return { ok: false, reason: `CURRENCY_MISMATCH:${confirmation.currency}` };
  }

  if (confirmation.requestedAmount !== undefined) {
    if (!Number.isFinite(confirmation.requestedAmount)) {
      return { ok: false, reason: "REQUESTED_AMOUNT_INVALID" };
    }
    if (toKurus(confirmation.requestedAmount) !== expected) {
      return {
        ok: false,
        reason: `REQUESTED_AMOUNT_MISMATCH:${confirmation.requestedAmount}!=${toFixed2(expectedAmount)}`,
      };
    }
  }

  if (confirmation.paidAmount !== undefined) {
    if (!Number.isFinite(confirmation.paidAmount)) {
      return { ok: false, reason: "PAID_AMOUNT_INVALID" };
    }
    if (toKurus(confirmation.paidAmount) < expected) {
      return {
        ok: false,
        reason: `PAID_AMOUNT_MISMATCH:${confirmation.paidAmount}<${toFixed2(expectedAmount)}`,
      };
    }
  }

  return { ok: true };
}

export async function fulfillPaymentsByGatewayReference(
  tx: Prisma.TransactionClient,
  reference: string,
  notes: string,
  confirmation?: GatewayPaymentConfirmation
) {
  // FAILED rows are earlier sessions closed when another session paid the
  // invoice; their callback is still processed so a double charge is recorded.
  const payments = await tx.payment.findMany({
    where: {
      transactionId: reference,
      status: { in: ["PENDING", "FAILED"] },
    },
    select: {
      id: true,
      invoiceId: true,
      amount: true,
      notes: true,
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
      amountMismatch: false,
      invoiceIds: [] as string[],
    };
  }

  const expectedAmount = sum(payments.map((payment) => payment.amount));
  const verification = verifyGatewayAmount(expectedAmount, confirmation);

  if (!verification.ok) {
    console.error(
      `[Gateway] Tutar doğrulaması başarısız (referans ${reference}): ${verification.reason}. Fatura ödenmiş sayılmadı.`
    );

    for (const payment of payments) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          notes: `Tutar uyuşmazlığı (${verification.reason}) | ${payment.notes ?? ""}`,
        },
      });
    }

    return {
      fulfilled: false,
      skipped: false,
      amountMismatch: true,
      invoiceIds: [] as string[],
    };
  }

  const meta = parseGatewayMeta(payments[0]?.notes);
  const customerId = meta?.customerId ?? "gateway";
  const invoiceIds = [...new Set(payments.map((payment) => payment.invoiceId))];
  const fulfilledInvoiceIds: string[] = [];

  for (const invoiceId of invoiceIds) {
    const result = await fulfillInvoicePayment(tx, {
      invoiceId,
      performedBy: customerId,
      paymentReference: reference,
      notes,
    });

    if (result.fulfilled) {
      fulfilledInvoiceIds.push(invoiceId);
    }
  }

  return {
    fulfilled: fulfilledInvoiceIds.length > 0,
    skipped: fulfilledInvoiceIds.length === 0,
    amountMismatch: false,
    invoiceIds: fulfilledInvoiceIds,
  };
}

export async function fulfillGatewayReference(
  reference: string,
  notes: string,
  confirmation?: GatewayPaymentConfirmation
) {
  const result = await db.$transaction(async (tx) =>
    fulfillPaymentsByGatewayReference(tx, reference, notes, confirmation)
  );

  if (result.fulfilled) {
    await runUnsuspendJobsForInvoices(result.invoiceIds);
    await Promise.allSettled(
      result.invoiceIds.map((invoiceId) => notifyInvoicePaymentReceived(invoiceId))
    );
  }

  return result;
}
