import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  finalizeFulfilledInvoices,
  fulfillInvoicePayment,
  type FulfillInvoicePaymentResult,
} from "@/lib/payments/fulfillment";
import { add, isPositive, max, sub, sum, toFixed2, toNumber } from "@/lib/money";

const PAYABLE_STATUSES = new Set(["PENDING", "OVERDUE"]);

export class BalancePaymentError extends Error {}

/**
 * Pays open invoices from the customer's account balance in one transaction:
 * locks the invoices, debits the balance only if it covers the total, writes
 * the ledger row and settles each invoice through the shared fulfilment path.
 * A second concurrent request waits on the row locks and then finds the
 * invoices PAID, so the balance is never debited twice.
 */
export async function payInvoicesFromBalance(
  tx: Prisma.TransactionClient,
  input: { customerId: string; invoiceIds: string[]; performedBy: string }
) {
  const invoiceIds = [...new Set(input.invoiceIds)];
  if (invoiceIds.length === 0) throw new BalancePaymentError("INVOICE_IDS_REQUIRED");

  await tx.$queryRaw`SELECT id FROM invoices WHERE id IN (${Prisma.join(invoiceIds)}) FOR UPDATE`;

  const invoices = await tx.invoice.findMany({
    where: { id: { in: invoiceIds } },
    select: { id: true, invoiceNumber: true, customerId: true, status: true, totalAmount: true, paidAmount: true },
  });

  if (invoices.length !== invoiceIds.length) throw new BalancePaymentError("INVOICE_NOT_FOUND");
  for (const invoice of invoices) {
    if (invoice.customerId !== input.customerId) throw new BalancePaymentError("INVOICE_FORBIDDEN");
    if (!PAYABLE_STATUSES.has(invoice.status)) throw new BalancePaymentError("INVOICE_NOT_PAYABLE");
  }

  const lines = invoices.map((invoice) => ({
    invoice,
    amount: max(0, sub(invoice.totalAmount, invoice.paidAmount)),
  }));
  const total = sum(lines.map((line) => line.amount));
  if (!isPositive(total)) throw new BalancePaymentError("NOTHING_TO_PAY");

  // Conditional debit: never lets the balance go negative, even under races.
  const debited = await tx.user.updateMany({
    where: { id: input.customerId, balance: { gte: total } },
    data: { balance: { decrement: total } },
  });
  if (debited.count === 0) throw new BalancePaymentError("INSUFFICIENT_BALANCE");

  const customer = await tx.user.findUniqueOrThrow({
    where: { id: input.customerId },
    select: { balance: true },
  });

  const reference = `BAL-${randomUUID()}`;
  const numbers = invoices.map((invoice) => invoice.invoiceNumber).join(", ");

  await tx.transaction.create({
    data: {
      customerId: input.customerId,
      type: "PAYMENT",
      amount: total,
      balanceBefore: add(customer.balance, total),
      balanceAfter: customer.balance,
      description: `Bakiye ile fatura ödemesi: ${numbers} (${toFixed2(total)} TL)`,
      referenceId: reference,
    },
  });

  const fulfilments: FulfillInvoicePaymentResult[] = [];
  for (const { invoice, amount } of lines) {
    const unbound = await tx.payment.findFirst({
      where: { invoiceId: invoice.id, method: "BALANCE", status: "PENDING", transactionId: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (unbound) {
      await tx.payment.update({
        where: { id: unbound.id },
        data: { transactionId: reference, amount },
      });
    } else {
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          customerId: input.customerId,
          amount,
          method: "BALANCE",
          status: "PENDING",
          transactionId: reference,
        },
      });
    }

    fulfilments.push(
      await fulfillInvoicePayment(tx, {
        invoiceId: invoice.id,
        performedBy: input.performedBy,
        paymentReference: reference,
        notes: "Hesap bakiyesi ile ödendi",
      })
    );
  }

  return {
    reference,
    total: toNumber(total),
    invoiceIds: invoices.map((invoice) => invoice.id),
    fulfilments,
  };
}

/** Transaction + the post-commit steps every fulfilment path runs. */
export async function payInvoicesWithBalance(input: {
  customerId: string;
  invoiceIds: string[];
  performedBy: string;
}) {
  const result = await db.$transaction((tx) => payInvoicesFromBalance(tx, input));
  // Notifications, e-fatura and provisioning were queued with the payment.
  await finalizeFulfilledInvoices(result.fulfilments);
  return result;
}

export function balancePaymentErrorMessage(error: unknown): string | null {
  if (!(error instanceof BalancePaymentError)) return null;
  switch (error.message) {
    case "INSUFFICIENT_BALANCE":
      return "Bakiyeniz bu ödeme için yeterli değil.";
    case "INVOICE_NOT_PAYABLE":
      return "Fatura ödemeye açık değil.";
    case "NOTHING_TO_PAY":
      return "Ödenecek tutar bulunamadı.";
    default:
      return "Bakiye ile ödeme yapılamadı.";
  }
}
