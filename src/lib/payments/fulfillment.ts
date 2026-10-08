import type { Prisma } from "@prisma/client";
import { applyAffiliateCommission } from "@/lib/affiliate";
import { db } from "@/lib/db";
import { dispatchEvents } from "@/lib/events/dispatcher";
import type {
  KleacoreEvent,
  PaymentCompletedContext,
} from "@/lib/events/types";
import { sendNotification } from "@/lib/notifications/send";
import { queueEInvoiceDraft } from "@/lib/integrations/efatura";
import { applyServiceRenewalFromOrder } from "@/lib/payments/renewal-fulfillment";
import { applyPlanChangeFromOrder } from "@/lib/services/plan-change";
import { unsuspendServiceIfNeeded } from "@/lib/payments/service-lifecycle";
import { provisionCompletedOrder } from "@/lib/provisioning/internal";
import { max as maxMoney, toNumber, type MoneyInput } from "@/lib/money";

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

function buildFulfillmentEvents(
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
  orderCompleted: boolean
): KleacoreEvent[] {
  const events: KleacoreEvent[] = [];

  let context: PaymentCompletedContext = "invoice";
  if (renewal?.applied) {
    context = "renewal";
  } else if (orderCompleted) {
    context = "order";
  }

  events.push({
    type: "payment.completed",
    payload: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      amount: toNumber(invoice.totalAmount),
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
          newExpiryDate: renewal.newExpiryDate.toISOString(),
          renewalMonths,
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
      },
    });
  }

  return events;
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

export async function fulfillInvoicePayment(
  tx: Prisma.TransactionClient,
  input: FulfillInvoicePaymentInput
) {
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
    where: { id: invoice.id, status: { notIn: ["PAID", "CANCELLED"] } },
    data: {
      status: "PAID",
      paidAt: invoice.paidAt ?? now,
      paidAmount: invoice.totalAmount,
    },
  });

  if (transition.count === 0) {
    await recordPaymentOnSettledInvoice(tx, invoice.id, input);
    return { fulfilled: false as const, invoice };
  }

  await completeInvoicePayment(tx, invoice.id, now, input);

  let renewal: RenewalResult | null = null;
  let orderCompleted = false;

  if (invoice.orderId && invoice.order && invoice.order.status !== "COMPLETED") {
    orderCompleted = true;

    await tx.order.update({
      where: { id: invoice.orderId },
      data: {
        status: "COMPLETED",
        approvedAt: invoice.order.approvedAt ?? now,
        approvedBy: input.performedBy,
        completedAt: now,
      },
    });

    renewal = await applyServiceRenewalFromOrder(tx, invoice.orderId);

    if (renewal.applied) {
      await tx.orderActivity.create({
        data: {
          orderId: invoice.orderId,
          action: "RENEWED",
          description: "Ödeme tamamlandı ve hizmet yenilendi",
          performedBy: input.performedBy,
          metadata: {
            invoiceId: invoice.id,
            paymentReference: input.paymentReference,
            serviceId: renewal.serviceId,
            newExpiryDate: renewal.newExpiryDate?.toISOString(),
          },
        },
      });
    } else {
      const planChange: PlanChangeResult = await applyPlanChangeFromOrder(
        tx,
        invoice.orderId,
        input.performedBy
      );

      if (!planChange.applied) {
        const provisioned = await provisionCompletedOrder(tx, invoice.orderId);

        await tx.orderActivity.create({
          data: {
            orderId: invoice.orderId,
            action: "PAYMENT_FULFILLED",
            description:
              "partialFailure" in provisioned && provisioned.partialFailure
                ? "Ödeme tamamlandı, sağlama başarısız oldu ve yeniden denenecek"
                : "manual" in provisioned && provisioned.manual
                  ? "Ödeme tamamlandı, manuel kurulum görevi açıldı"
                  : provisioned.type === "domain"
                  ? "Ödeme tamamlandı ve domain registrara iletildi"
                  : "Ödeme tamamlandı ve hizmet aktifleştirildi",
            performedBy: input.performedBy,
            metadata: {
              invoiceId: invoice.id,
              paymentReference: input.paymentReference,
              ...provisioned,
            },
          },
        });
      }
    }

    if (invoice.order?.serviceId) {
      await unsuspendServiceIfNeeded(tx, invoice.order.serviceId, invoice.orderId);
    }
  }

  await applyAffiliateCommission(tx, {
    customerId: invoice.customerId,
    orderTotal: invoice.totalAmount,
  });

  dispatchEvents(buildFulfillmentEvents(invoice, input, renewal, orderCompleted), {
    userId: input.performedBy,
  });

  void queueEInvoiceDraft(invoice.id).catch((error) => {
    console.error("[E-Fatura] Taslak kuyruğa alınamadı:", error);
  });

  return { fulfilled: true as const, invoice };
}

/**
 * "Ödeme alındı" e-posta (+ SMS when configured). Idempotent per invoice:
 * gateway callbacks, webhooks and the admin "ödendi" button may all call it.
 */
export async function notifyInvoicePaymentReceived(invoiceId: string) {
  try {
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
      return;
    }

    await sendNotification({
      userId: invoice.customerId,
      template: "billing.payment-received",
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        paidAmount: toNumber(maxMoney(invoice.paidAmount, invoice.totalAmount)),
        paidAt: invoice.paidAt ?? invoice.updatedAt,
      },
      dedupeKey: `payment.received:${invoice.id}`,
    });
  } catch (error) {
    console.error("[Fulfillment] Ödeme bildirimi gönderilemedi:", error);
  }
}
