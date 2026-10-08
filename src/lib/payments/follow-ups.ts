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

export interface PaymentFollowUps {
  invoiceId: string;
  userId: string;
  events: KleacoreEvent[];
}

/**
 * Queues the after-payment work (e-invoice, webhooks/events, notification)
 * in the payment transaction: it runs only if the payment commits and is
 * never lost once it did. Returns false when the queue is unavailable; the
 * caller then runs `runPaymentFollowUpsWithoutQueue` after commit.
 */
export async function queuePaymentFollowUps(
  tx: Prisma.TransactionClient,
  followUps: PaymentFollowUps
): Promise<boolean> {
  const { isJobQueueReady } = await import("@/lib/provisioning/queue");
  if (!(await isJobQueueReady())) {
    return false;
  }

  const { enqueue } = await import("@/lib/jobs/enqueue");
  const queued = await withSavepoint(tx, async () => {
    await enqueue(
      "efatura.issue",
      { invoiceId: followUps.invoiceId },
      { singletonKey: followUps.invoiceId, tx }
    );
    await enqueue(
      "payment.settled",
      {
        invoiceId: followUps.invoiceId,
        userId: followUps.userId,
        events: followUps.events as unknown as Array<{
          type: KleacoreEvent["type"];
          payload: Record<string, unknown>;
        }>,
      },
      { singletonKey: followUps.invoiceId, tx }
    );
  });

  if (!queued.ok) {
    log.error("could not queue payment follow-ups", { invoiceId: followUps.invoiceId, error: queued.error });
  }
  return queued.ok;
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

/** Handler of "payment.settled". */
export async function runPaymentSettledJob(payload: {
  invoiceId: string;
  userId: string;
  events: Array<{ type: string; payload: Record<string, unknown> }>;
}) {
  const { db } = await import("@/lib/db");
  const invoice = await db.invoice.findUnique({
    where: { id: payload.invoiceId },
    select: { customerId: true },
  });
  if (!invoice) {
    return { skipped: "INVOICE_NOT_FOUND" };
  }

  // Notification first: it is the only step that can fail (enqueue) and a
  // retry must not re-send the webhooks below.
  const { sendNotification } = await import("@/lib/notifications/send");
  await sendNotification({
    userId: invoice.customerId,
    template: "payment_received",
    data: { invoiceId: payload.invoiceId },
  });

  const { dispatchEvent } = await import("@/lib/events/dispatcher");
  for (const event of payload.events as unknown as KleacoreEvent[]) {
    await dispatchEvent(event, { userId: payload.userId });
  }

  return { ok: true };
}

/**
 * Fallback after commit when the follow-ups could not be queued with the
 * payment: try the queue again, else run them inline. Never throws.
 */
export async function runPaymentFollowUpsWithoutQueue(followUps: PaymentFollowUps) {
  try {
    const { enqueue } = await import("@/lib/jobs/enqueue");
    await enqueue("efatura.issue", { invoiceId: followUps.invoiceId }, { singletonKey: followUps.invoiceId });
    await enqueue(
      "payment.settled",
      {
        invoiceId: followUps.invoiceId,
        userId: followUps.userId,
        events: followUps.events as unknown as Array<{
          type: KleacoreEvent["type"];
          payload: Record<string, unknown>;
        }>,
      },
      { singletonKey: followUps.invoiceId }
    );
    return;
  } catch (error) {
    log.error("job queue unavailable after payment; running follow-ups inline", {
      invoiceId: followUps.invoiceId,
      error,
    });
  }

  const results = await Promise.allSettled([
    runEInvoiceIssueJob(followUps.invoiceId),
    (async () => {
      const { notifyInvoicePaymentReceived } = await import("@/lib/payments/fulfillment");
      await notifyInvoicePaymentReceived(followUps.invoiceId);
      const { dispatchEvent } = await import("@/lib/events/dispatcher");
      for (const event of followUps.events) {
        await dispatchEvent(event, { userId: followUps.userId });
      }
    })(),
  ]);
  for (const result of results) {
    if (result.status === "rejected") {
      log.error("inline payment follow-up failed", { invoiceId: followUps.invoiceId, error: result.reason });
    }
  }
}
