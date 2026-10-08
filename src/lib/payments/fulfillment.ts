import type { Prisma } from "@prisma/client";
import { applyAffiliateCommission } from "@/lib/affiliate";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import type { EventInput, EventType } from "@/lib/events/catalog";
import type { PaymentCompletedContext } from "@/lib/events/types";
import { sendNotification } from "@/lib/notifications/send";
import { applyServiceRenewalFromOrder } from "@/lib/payments/renewal-fulfillment";
import { applyPlanChangeFromOrder } from "@/lib/services/plan-change";
import { unsuspendServiceIfNeeded } from "@/lib/payments/service-lifecycle";
import {
  prepareOrderProvisioning,
  type PreparedProvisioning,
} from "@/lib/provisioning/internal";
import { withSavepoint } from "@/lib/payments/follow-ups";
import { createLogger } from "@/lib/logger";
import { max as maxMoney, toNumber, type MoneyInput } from "@/lib/money";

const log = createLogger("payments.fulfillment");
import { onDomainRenewalPaid } from "@/lib/domains/renew";

interface FulfillInvoicePaymentInput {
  invoiceId: string;
  performedBy: string;
  paymentReference?: string;
  notes?: string;
}

type RenewalResult = {
  applied: boolean;
  serviceId?: string;
  newExpiryDate?: Date;
};

type PlanChangeResult = {
  applied: boolean;
  planChangeId?: string;
  serviceId?: string;
  changeType?: "UPGRADE" | "DOWNGRADE";
};

function parseRenewalMonths(configuration: unknown): number | null {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
    return null;
  }

  const renewalMonths = (configuration as Record<string, unknown>).renewalMonths;
  if (typeof renewalMonths !== "number" || !Number.isFinite(renewalMonths) || renewalMonths <= 0) {
    return null;
  }

  return Math.round(renewalMonths);
}

/** A catalogue event waiting to be emitted (outbox) for a paid invoice. */
export type PendingEvent = { [T in EventType]: { type: T; payload: EventInput<T> } }[EventType];

/**
 * Events of a paid invoice: invoice.paid always (notification, e-invoice,
 * "payment.completed" webhook), plus service.renewed for a renewal, or
 * order.paid for a completed new order, or service.plan_changed.
 */
export function buildFulfillmentEvents(
  invoice: {
    id: string;
    invoiceNumber: string;
    customerId: string;
    totalAmount: MoneyInput;
    orderId: string | null;
    order: {
      id: string;
      orderNumber: string;
      totalAmount: MoneyInput;
      items: Array<{ configuration: unknown }>;
    } | null;
  },
  input: FulfillInvoicePaymentInput,
  renewal: RenewalResult | null,
  orderCompleted: boolean,
  paidAt: Date,
  planChange: PlanChangeResult | null = null
): PendingEvent[] {
  const events: PendingEvent[] = [];

  let context: PaymentCompletedContext = "invoice";
  if (renewal?.applied) {
    context = "renewal";
  } else if (orderCompleted) {
    context = "order";
  }

  events.push({
    type: "invoice.paid",
    payload: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      amount: toNumber(invoice.totalAmount),
      paidAt,
      paymentReference: input.paymentReference,
      context,
    },
  });

  if (renewal?.applied && renewal.serviceId && renewal.newExpiryDate && invoice.order) {
    const renewalMonths = parseRenewalMonths(invoice.order.items.at(0)?.configuration);
    if (renewalMonths) {
      events.push({
        type: "service.renewed",
        payload: {
          serviceId: renewal.serviceId,
          customerId: invoice.customerId,
          newExpiryDate: renewal.newExpiryDate,
          renewalMonths,
          invoiceId: invoice.id,
        },
      });
    }
  } else if (orderCompleted && invoice.orderId && invoice.order) {
    events.push({
      type: "order.paid",
      payload: {
        orderId: invoice.orderId,
        orderNumber: invoice.order.orderNumber,
        customerId: invoice.customerId,
        totalAmount: toNumber(invoice.order.totalAmount),
        invoiceId: invoice.id,
      },
    });
    if (planChange?.applied && planChange.serviceId && planChange.planChangeId && planChange.changeType) {
      events.push({
        type: "service.plan_changed",
        payload: {
          serviceId: planChange.serviceId,
          customerId: invoice.customerId,
          planChangeId: planChange.planChangeId,
          changeType: planChange.changeType,
          invoiceId: invoice.id,
        },
      });
    }
  }

  return events;
}

function eventActor(performedBy: string) {
  return performedBy && performedBy !== "system" ? performedBy : null;
}

/** Writes the events through `client` (the payment transaction, or db after commit). */
async function emitPendingEvents(
  client: Parameters<typeof emitEvent>[0],
  events: PendingEvent[],
  actorId: string | null
) {
  for (const event of events) {
    await emitEvent(client, event.type, event.payload as never, { actorId });
  }
}

const SUPERSEDED_PAYMENT_NOTE = "Fatura başka bir ödeme ile kapandı";
const DUPLICATE_PAYMENT_NOTE =
  "MÜKERRER ÖDEME: fatura zaten ödenmişti, iade veya bakiye aktarımı gerekli";

/**
 * Marks the payment that settled the invoice COMPLETED. With a gateway
 * reference that is the row bound to that session; otherwise (admin "ödendi",
 * legacy rows) the newest unbound pending row, falling back to the newest
 * pending one. Other sessions still PENDING for this invoice are closed as
 * FAILED so they don't count as received money.
 */
async function completeInvoicePayment(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  now: Date,
  input: FulfillInvoicePaymentInput
) {
  const pending = await tx.payment.findMany({
    where: { invoiceId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true, transactionId: true },
  });

  const settling =
    (input.paymentReference
      ? pending.find((payment) => payment.transactionId === input.paymentReference)
      : undefined) ??
    pending.find((payment) => payment.transactionId === null) ??
    pending[0];

  if (settling) {
    await tx.payment.update({
      where: { id: settling.id },
      data: {
        status: "COMPLETED",
        paidAt: now,
        transactionId: settling.transactionId ?? input.paymentReference,
        notes: input.notes ?? "Ödeme tamamlandı",
      },
    });
  }

  const superseded = pending
    .filter((payment) => payment.id !== settling?.id)
    .map((payment) => payment.id);

  if (superseded.length > 0) {
    await tx.payment.updateMany({
      where: { id: { in: superseded }, status: "PENDING" },
      data: { status: "FAILED", notes: SUPERSEDED_PAYMENT_NOTE },
    });
  }
}

/**
 * The invoice was already PAID when this payment arrived. A repeated callback
 * of the session that paid it finds its row COMPLETED and does nothing. A
 * different session that was really charged (customer paid twice) is recorded
 * as COMPLETED with a duplicate note and logged so an admin can refund it.
 */
async function recordPaymentOnSettledInvoice(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  input: FulfillInvoicePaymentInput
) {
  if (!input.paymentReference) {
    return;
  }

  const duplicate = await tx.payment.updateMany({
    where: {
      invoiceId,
      transactionId: input.paymentReference,
      status: { in: ["PENDING", "FAILED"] },
    },
    data: {
      status: "COMPLETED",
      paidAt: new Date(),
      notes: DUPLICATE_PAYMENT_NOTE,
    },
  });

  if (duplicate.count > 0) {
    console.error(
      `[Fulfillment] Ödenmiş faturaya ikinci ödeme alındı (fatura ${invoiceId}, referans ${input.paymentReference}). İade gerekebilir.`
    );
  }
}

export type FulfillInvoicePaymentResult =
  | {
      fulfilled: true;
      invoice: { id: string };
      /** False when the queue was down: run `finalizeFulfilledInvoices` after commit. */
      /**
       * False when the events could not be written with the payment (their
       * savepoint failed): `finalizeFulfilledInvoices` writes them after commit.
       */
      eventsRecorded: boolean;
      events: PendingEvent[];
      actorId: string | null;
      /** Set when the order's activation failed and was parked for the admin. */
      fulfilmentError?: string;
    }
  | { fulfilled: false; invoice: { id: string } };

export interface PaidOrderEffects {
  renewal: RenewalResult | null;
  planChange: PlanChangeResult | null;
  provisioned: PreparedProvisioning | null;
}

function describeProvisioning(provisioned: PreparedProvisioning) {
  if (provisioned.status === "NEEDS_ACTION") {
    return "Ödeme alındı; kurulum için yönetici müdahalesi gerekli";
  }
  if (provisioned.status === "EXISTING") {
    return "Ödeme tamamlandı";
  }
  if (provisioned.status === "MANUAL") {
    return "Ödeme tamamlandı; manuel kurulum görevi açıldı";
  }
  return provisioned.type === "domain"
    ? "Ödeme tamamlandı; alan adı kaydı kuyruğa alındı"
    : provisioned.type === "ssl"
      ? "Ödeme tamamlandı; SSL siparişi kuyruğa alındı"
      : "Ödeme tamamlandı; hizmet oluşturuldu, kurulum kuyruğa alındı";
}

/**
 * Local effects of a paid order, inside the payment transaction: order
 * COMPLETED, renewal / plan change applied, activation records (domain, SSL
 * certificate, service) and their ProvisioningJob. No remote call happens
 * here; registrar / SSL / WHM work runs in the provisioning.run job.
 */
export async function applyPaidOrderEffects(
  tx: Prisma.TransactionClient,
  orderId: string,
  context: { performedBy: string; invoiceId: string; paymentReference?: string }
): Promise<PaidOrderEffects> {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  const now = new Date();
  await tx.order.update({
    where: { id: orderId },
    data: {
      status: "COMPLETED",
      approvedAt: order.approvedAt ?? now,
      approvedBy: context.performedBy,
      completedAt: now,
    },
  });

  const renewal: RenewalResult = await applyServiceRenewalFromOrder(tx, orderId);
  let planChange: PlanChangeResult | null = null;
  let provisioned: PreparedProvisioning | null = null;

  if (renewal.applied) {
    await tx.orderActivity.create({
      data: {
        orderId,
        action: "RENEWED",
        description: "Ödeme tamamlandı ve hizmet yenilendi",
        performedBy: context.performedBy,
        metadata: {
          invoiceId: context.invoiceId,
          paymentReference: context.paymentReference,
          serviceId: renewal.serviceId,
          newExpiryDate: renewal.newExpiryDate?.toISOString(),
        },
      },
    });
  } else {
    planChange = await applyPlanChangeFromOrder(tx, orderId, context.performedBy);

    if (!planChange.applied) {
      provisioned = await prepareOrderProvisioning(tx, orderId);

      await tx.orderActivity.create({
        data: {
          orderId,
          action: "PAYMENT_FULFILLED",
          description: describeProvisioning(provisioned),
          performedBy: context.performedBy,
          metadata: {
            invoiceId: context.invoiceId,
            paymentReference: context.paymentReference,
            ...provisioned,
          },
        },
      });
    }
  }

  // Paying a renewal (or any non-plan-change invoice of the service) lifts a
  // non-payment suspension; a plan change payment doesn't settle the debt.
  if (order.serviceId && !planChange?.applied) {
    await unsuspendServiceIfNeeded(tx, order.serviceId, orderId);
  }

  return { renewal: renewal.applied ? renewal : null, planChange, provisioned };
}

/**
 * Records that the order's activation failed after the payment was taken:
 * the order stays PROCESSING (paid, not delivered) and a FAILED
 * ProvisioningJob with the reason shows up on /yonetim/provisioning.
 */
async function parkFailedOrderFulfilment(
  tx: Prisma.TransactionClient,
  orderId: string,
  error: unknown,
  context: { performedBy: string; invoiceId: string; paymentReference?: string }
) {
  const reason = error instanceof Error ? error.message : String(error);
  const lastError = `FULFILMENT_ERROR: ${reason}. Ödeme kaydedildi; sipariş teslim edilmedi.`.slice(0, 2000);
  const now = new Date();

  await tx.order.update({
    where: { id: orderId },
    data: { status: "PROCESSING", processingStartedAt: now },
  });
  await tx.provisioningJob.upsert({
    where: { orderId },
    create: { orderId, kind: "PROVISION", status: "FAILED", attempts: 0, lastError, nextRetryAt: now },
    update: { kind: "PROVISION", status: "FAILED", lastError, nextRetryAt: now, completedAt: null },
  });
  await tx.orderActivity.create({
    data: {
      orderId,
      action: "FULFILMENT_FAILED",
      description: "Ödeme alındı ancak sipariş teslim edilemedi; yönetici müdahalesi gerekli",
      performedBy: context.performedBy,
      metadata: {
        invoiceId: context.invoiceId,
        paymentReference: context.paymentReference,
        error: reason,
      },
    },
  });
  return lastError;
}

/**
 * Records a successful payment of one invoice, in one short transaction:
 * Payment COMPLETED, invoice PAID (idempotent conditional update), order
 * activation records + ProvisioningJob, affiliate commission, and the queued
 * follow-ups (e-invoice, events, notification).
 *
 * Nothing here talks to a registrar, SSL vendor, WHM or the e-invoice
 * provider, and a failure while activating the order (bad order data, a
 * missing service) is rolled back to a savepoint and parked for the admin —
 * it never rolls back the recorded payment. Call `finalizeFulfilledInvoices`
 * with the results after the transaction committed.
 */
export async function fulfillInvoicePayment(
  tx: Prisma.TransactionClient,
  input: FulfillInvoicePaymentInput
): Promise<FulfillInvoicePaymentResult> {
  const invoice = await tx.invoice.findUnique({
    where: { id: input.invoiceId },
    include: {
      order: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new Error("INVOICE_NOT_FOUND");
  }

  if (invoice.status === "CANCELLED") {
    throw new Error("INVOICE_CANCELLED");
  }

  const now = new Date();

  // Conditional state transition: of two concurrent callbacks (PayTR retry,
  // iyzico redirect + webhook, Stripe events) only the one whose UPDATE flips
  // the row to PAID continues. The other blocks on the row lock, re-evaluates
  // the WHERE after commit, matches 0 rows and becomes an idempotent no-op —
  // so provisioning, renewal and affiliate commission run exactly once.
  const transition = await tx.invoice.updateMany({
    // Refunded invoices were paid once already; a late callback must not
    // re-open and re-provision them (gateways owner: refunds module).
    where: { id: invoice.id, status: { notIn: ["PAID", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"] } },
    data: {
      status: "PAID",
      paidAt: invoice.paidAt ?? now,
      paidAmount: invoice.totalAmount,
    },
  });

  if (transition.count === 0) {
    await recordPaymentOnSettledInvoice(tx, invoice.id, input);
    return { fulfilled: false, invoice };
  }

  await completeInvoicePayment(tx, invoice.id, now, input);

  // Domain renewal invoices carry no order: route the payment to the
  // registrar renew (domain.renew job, enqueued in this transaction). Local
  // work only; a failure here must not roll back the payment — the renewal
  // stays PENDING on a PAID invoice and the domain-renewals cron routes it.
  const domainRenewal = await withSavepoint(tx, () => onDomainRenewalPaid(invoice.id, tx));
  if (!domainRenewal.ok) {
    log.error("domain renewal routing failed after payment; cron will retry", {
      invoiceId: invoice.id,
      error: domainRenewal.error,
    });
  }

  let renewal: RenewalResult | null = null;
  let planChange: PlanChangeResult | null = null;
  let orderCompleted = false;
  let fulfilmentError: string | undefined;

  if (invoice.orderId && invoice.order && invoice.order.status !== "COMPLETED") {
    const orderId = invoice.orderId;
    const context = {
      performedBy: input.performedBy,
      invoiceId: invoice.id,
      paymentReference: input.paymentReference,
    };
    const effects = await withSavepoint(tx, () => applyPaidOrderEffects(tx, orderId, context));

    if (effects.ok) {
      orderCompleted = true;
      renewal = effects.value.renewal;
      planChange = effects.value.planChange;
    } else {
      log.error("order activation failed after payment; parked for admin", {
        invoiceId: invoice.id,
        orderId,
        error: effects.error,
      });
      fulfilmentError = await parkFailedOrderFulfilment(tx, orderId, effects.error, context);
    }
  }

  await applyAffiliateCommission(tx, {
    customerId: invoice.customerId,
    orderTotal: invoice.totalAmount,
  });

  // Outbox: the events commit with the payment and drive the follow-ups
  // (e-invoice, "ödeme alındı", webhooks, activity log) after commit. In a
  // savepoint so a failure here can never roll back the recorded payment.
  const events = buildFulfillmentEvents(invoice, input, renewal, orderCompleted, invoice.paidAt ?? now, planChange);
  const actorId = eventActor(input.performedBy);
  const recorded = await withSavepoint(tx, () => emitPendingEvents(tx, events, actorId));
  if (!recorded.ok) {
    log.error("payment events could not be written with the payment; retrying after commit", {
      invoiceId: invoice.id,
      error: recorded.error,
    });
  }

  return { fulfilled: true, invoice, eventsRecorded: recorded.ok, events, actorId, fulfilmentError };
}

/**
 * After the payment transaction committed: runs the inline unsuspend fast
 * path (queue job is the backstop) and, only if the events could not be
 * written with the payment, writes them now. Never throws.
 */
export async function finalizeFulfilledInvoices(results: FulfillInvoicePaymentResult[]) {
  const fulfilled = results.filter(
    (result): result is Extract<FulfillInvoicePaymentResult, { fulfilled: true }> => result.fulfilled
  );
  if (fulfilled.length === 0) {
    return;
  }

  const { runUnsuspendJobsForInvoices } = await import("@/lib/payments/service-lifecycle");
  await runUnsuspendJobsForInvoices(fulfilled.map((result) => result.invoice.id));

  for (const result of fulfilled.filter((item) => !item.eventsRecorded)) {
    try {
      await emitPendingEvents(db, result.events, result.actorId);
    } catch (error) {
      log.error("payment events lost: could not be written after commit either", {
        invoiceId: result.invoice.id,
        events: result.events.map((event) => event.type),
        error,
      });
    }
  }
}

/**
 * "Ödeme alındı" (e-posta + SMS when configured) for a PAID invoice, as the
 * outbox notifications subscriber sends it for invoice.paid. Null when the
 * invoice is gone or no longer PAID (refunded/cancelled before delivery).
 * Idempotent per invoice through the dedupe key.
 */
export async function buildPaymentReceivedNotice(invoiceId: string) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      customerId: true,
      status: true,
      totalAmount: true,
      paidAmount: true,
      paidAt: true,
      updatedAt: true,
    },
  });

  if (!invoice || invoice.status !== "PAID") {
    return null;
  }

  return {
    userId: invoice.customerId,
    template: "billing.payment-received" as const,
    data: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      paidAmount: toNumber(maxMoney(invoice.paidAmount, invoice.totalAmount)),
      paidAt: invoice.paidAt ?? invoice.updatedAt,
    },
    dedupeKey: `payment.received:${invoice.id}`,
  };
}

/**
 * Queues "ödeme alındı" directly (legacy payment.settled jobs queued before
 * the outbox deploy). Throws when it could not be queued (the job retries).
 */
export async function queuePaymentReceivedNotice(invoiceId: string) {
  const notice = await buildPaymentReceivedNotice(invoiceId);
  if (!notice) {
    return { skipped: true as const };
  }

  const result = await sendNotification(notice);
  if (!result.ok) {
    throw new Error(result.error ?? "NOTIFICATION_NOT_QUEUED");
  }
  return { skipped: false as const };
}

/** Same as `queuePaymentReceivedNotice`, never throws (inline fallbacks). */
export async function notifyInvoicePaymentReceived(invoiceId: string) {
  try {
    await queuePaymentReceivedNotice(invoiceId);
  } catch (error) {
    console.error("[Fulfillment] Ödeme bildirimi gönderilemedi:", error);
  }
}
