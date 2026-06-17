import type { Prisma } from "@prisma/client";
import { applyAffiliateCommission } from "@/lib/affiliate";
import { db } from "@/lib/db";
import { dispatchEvents } from "@/lib/events/dispatcher";
import type {
  KleacoreEvent,
  PaymentCompletedContext,
} from "@/lib/events/types";
import {
  loadCustomerRecipient,
  sendPaymentReceivedEmail,
} from "@/lib/notifications/email";
import { sendSmsNotification } from "@/lib/notifications/sms";
import { queueEInvoiceDraft } from "@/lib/integrations/efatura";
import { applyServiceRenewalFromOrder } from "@/lib/payments/renewal-fulfillment";
import { applyPlanChangeFromOrder } from "@/lib/services/plan-change";
import { unsuspendServiceIfNeeded } from "@/lib/payments/service-lifecycle";
import { provisionCompletedOrder } from "@/lib/provisioning/internal";

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
    totalAmount: number;
    orderId: string | null;
    order: {
      id: string;
      orderNumber: string;
      totalAmount: number;
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
      amount: invoice.totalAmount,
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
        totalAmount: invoice.order.totalAmount,
      },
    });
  }

  return events;
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

  if (invoice.status === "PAID") {
    return invoice;
  }

  const now = new Date();

  await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "PAID",
      paidAt: invoice.paidAt ?? now,
      paidAmount: invoice.totalAmount,
    },
  });

  await tx.payment.updateMany({
    where: { invoiceId: invoice.id, status: "PENDING" },
    data: {
      status: "COMPLETED",
      paidAt: now,
      transactionId: input.paymentReference,
      notes: input.notes ?? "Ödeme tamamlandı",
    },
  });

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
              provisioned.type === "domain"
                ? "Ödeme tamamlandı ve domain aktifleştirildi"
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
      await unsuspendServiceIfNeeded(tx, invoice.order.serviceId);
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

  return invoice;
}

export async function notifyInvoicePaymentReceived(invoiceId: string) {
  try {
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        customerId: true,
        totalAmount: true,
        paidAmount: true,
        paidAt: true,
        updatedAt: true,
      },
    });

    if (!invoice) {
      return;
    }

    const customer = await loadCustomerRecipient(invoice.customerId);
    if (!customer) {
      return;
    }

    const paidAmount = Math.max(Number(invoice.paidAmount), Number(invoice.totalAmount));

    await sendPaymentReceivedEmail({
      customer,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      paidAmount,
      paidAt: invoice.paidAt ?? invoice.updatedAt,
    });

    await sendSmsNotification({
      customerId: invoice.customerId,
      message: `Faturanız ödendi: ${invoice.invoiceNumber}`,
      template: "payment_received",
    });
  } catch (error) {
    console.error("[Fulfillment] Ödeme bildirimi gönderilemedi:", error);
  }
}
