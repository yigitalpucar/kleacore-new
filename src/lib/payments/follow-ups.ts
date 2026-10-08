import type { Prisma } from "@prisma/client";
import type { KleacoreEvent } from "@/lib/events/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("payments.follow-ups");

let savepointCounter = 0;

/**
 * Runs `fn` inside a SAVEPOINT of the caller's interactive transaction. If it
 * throws (including a database error that would otherwise abort the whole
 * transaction) only its writes are rolled back and the error is returned, so
 * the payment recorded before it still commits.
 */
export async function withSavepoint<T>(
  tx: Prisma.TransactionClient,
  fn: () => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  savepointCounter = (savepointCounter + 1) % 1_000_000;
  const name = `kc_sp_${savepointCounter}`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
  try {
    const value = await fn();
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`);
    return { ok: true, value };
  } catch (error) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
    return { ok: false, error };
  }
}

/** Handler of "efatura.issue". Throws only for errors worth retrying. */
export async function runEInvoiceIssueJob(invoiceId: string) {
  const { issueEInvoiceForInvoice } = await import("@/lib/integrations/efatura");
  const outcome = await issueEInvoiceForInvoice(invoiceId);

  if (outcome.ok) {
    return { ok: true, status: outcome.record.status };
  }
  if (outcome.skipped) {
    // E-invoicing disabled / not configured, or another attempt holds the
    // record: nothing to retry here.
    return { ok: false, skipped: outcome.reason };
  }
  // Bad invoice data is final: the FAILED EInvoiceRecord carries the reason
  // for the admin (/yonetim/e-fatura). Entegratör or network errors retry.
  if (/^EFATURA_[A-Z_]+:/.test(outcome.error)) {
    return { ok: false, error: outcome.error };
  }
  throw new Error(outcome.error);
}

/**
 * Handler of the legacy "payment.settled" job (queued before the outbox
 * deploy). New payments emit invoice.paid / order.paid / service.renewed.
 */
export async function runPaymentSettledJob(payload: {
  invoiceId: string;
  userId: string;
  events: Array<{ type: string; payload: Record<string, unknown> }>;
}) {
  const { db } = await import("@/lib/db");
  const invoice = await db.invoice.findUnique({
    where: { id: payload.invoiceId },
    select: { id: true },
  });
  if (!invoice) {
    return { skipped: "INVOICE_NOT_FOUND" };
  }

  // Notification first: it is the only step that can fail (enqueue) and a
  // retry must not re-send the webhooks below. Deduped per invoice.
  const { queuePaymentReceivedNotice } = await import("@/lib/payments/fulfillment");
  await queuePaymentReceivedNotice(payload.invoiceId);

  const { dispatchEvent } = await import("@/lib/events/dispatcher");
  for (const event of payload.events as unknown as KleacoreEvent[]) {
    await dispatchEvent(event, { userId: payload.userId });
  }

  return { ok: true };
}
