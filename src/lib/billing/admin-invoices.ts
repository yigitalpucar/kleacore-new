/**
 * Staff invoice operations shared by the admin server actions
 * (src/lib/actions/admin/invoices.ts) and the admin API
 * (/api/admin/v1/invoices). Callers check the permission and revalidate
 * pages; `actorId` / `performedBy` is the staff member the change is
 * attributed to. Failures carry the HTTP status the admin API answers with.
 */
import type { PaymentMethod } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { generateInvoiceNumber } from "@/lib/utils/number-generators";
import { sendInvoiceOverdueEmail, sendInvoicePaymentReminderEmail } from "@/lib/notifications/email";
import { finalizeFulfilledInvoices, fulfillInvoicePayment } from "@/lib/payments/fulfillment";
import { logActivity } from "@/lib/activity-log";
import { calculateInvoiceTotals } from "@/lib/billing/invoice-totals";
import { money } from "@/lib/money";

export type AdminInvoiceFailure = { success: false; error: string; status: number };

export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number | string;
  /** Ignored: recomputed on the server as round(quantity × unitPrice). */
  totalPrice?: number;
}

export interface InvoiceInput {
  customerId: string;
  orderId?: string;
  taxRate?: number;
  /** Ignored: subtotal / KDV / total are recomputed on the server from the items. */
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  dueDate: string;
  notes?: string;
  items: InvoiceItemInput[];
}

export async function createInvoiceAs(
  actorId: string,
  data: InvoiceInput
): Promise<{ success: true; data: { id: string; invoiceNumber: string } } | AdminInvoiceFailure> {
  const customer = await db.user.findUnique({
    where: { id: data.customerId },
  });
  if (!customer) {
    return { success: false, error: "Müşteri bulunamadı", status: 404 };
  }

  const taxRate = money(data.taxRate ?? 20);
  const itemsValid =
    Array.isArray(data.items) &&
    data.items.length > 0 &&
    data.items.every(
      (item) =>
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        money(item.unitPrice).greaterThanOrEqualTo(0)
    );
  if (!itemsValid || taxRate.isNegative() || taxRate.greaterThan(100)) {
    return { success: false, error: "Fatura kalemleri veya KDV oranı geçersiz", status: 422 };
  }

  // Totals are computed here, in Decimal, from the lines — never trusted
  // from the browser — so the invoice always equals the sum of its lines.
  const totals = calculateInvoiceTotals(data.items, taxRate);

  const invoiceNumber = await generateInvoiceNumber();

  // Invoice + invoice.created ("fatura oluştu" via the outbox) commit together.
  const invoice = await db.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        invoiceNumber,
        customerId: data.customerId,
        orderId: data.orderId ?? null,
        subtotal: totals.subtotal,
        taxRate: totals.taxRate,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        status: "PENDING",
        dueDate: new Date(data.dueDate),
        notes: data.notes ?? null,
        items: {
          create: data.items.map((item, index) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: totals.lines[index].unitPrice,
            totalPrice: totals.lines[index].totalPrice,
          })),
        },
      },
    });
    await emitEvent(
      tx,
      "invoice.created",
      {
        invoiceId: created.id,
        invoiceNumber,
        customerId: data.customerId,
        totalAmount: totals.totalAmount,
        dueDate: new Date(data.dueDate),
        source: "admin",
      },
      { actorId }
    );
    return created;
  });

  return { success: true, data: { id: invoice.id, invoiceNumber } };
}

/**
 * A payment received outside the gateways (havale, cash, …) recorded with the
 * "ödendi" action: a PENDING payment row for the open amount is written in
 * the payment transaction and settled by the regular fulfilment.
 */
export interface ManualPaymentInput {
  method: PaymentMethod;
  /** Bank reference / receipt number; generated when missing. */
  reference?: string;
}

/**
 * Marks an invoice paid through the regular fulfilment path (order
 * activation, renewals, outbox events, e-invoice) — same as a gateway
 * callback, attributed to `performedBy`.
 */
export async function fulfillInvoiceAsAdmin(
  id: string,
  performedBy: string,
  notes: string,
  manualPayment?: ManualPaymentInput
): Promise<{ success: true; warning?: string; paymentId?: string } | AdminInvoiceFailure> {
  const invoice = await db.invoice.findUnique({
    where: { id },
  });

  if (!invoice) {
    return { success: false, error: "Fatura bulunamadı", status: 404 };
  }

  if (invoice.status === "PAID") {
    return { success: false, error: "Bu fatura zaten ödenmiş", status: 409 };
  }

  if (invoice.status === "CANCELLED") {
    return { success: false, error: "İptal edilmiş fatura ödenemez", status: 409 };
  }

  const paymentReference = manualPayment ? manualPayment.reference?.trim() || `manual-${randomUUID()}` : undefined;
  if (paymentReference) {
    const taken = await db.payment.findFirst({
      where: { invoiceId: id, transactionId: paymentReference },
      select: { id: true },
    });
    if (taken) {
      return { success: false, error: "Bu ödeme referansı bu faturada zaten kayıtlı", status: 409 };
    }
  }

  let paymentId: string | undefined;
  const result = await db.$transaction(async (tx) => {
    if (manualPayment && paymentReference) {
      const outstanding = money(invoice.totalAmount).minus(invoice.paidAmount);
      const payment = await tx.payment.create({
        data: {
          invoiceId: id,
          customerId: invoice.customerId,
          amount: outstanding.isPositive() ? outstanding : money(invoice.totalAmount),
          method: manualPayment.method,
          status: "PENDING",
          transactionId: paymentReference,
          notes,
        },
        select: { id: true },
      });
      paymentId = payment.id;
    }
    return fulfillInvoicePayment(tx, {
      invoiceId: id,
      performedBy,
      notes,
      paymentReference,
    });
  });

  await logActivity({
    userId: performedBy,
    action: "INVOICE_PAID",
    entity: "Invoice",
    entityId: id,
    details: {
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: Number(invoice.totalAmount),
      notes,
      ...(manualPayment ? { method: manualPayment.method, reference: paymentReference ?? null } : {}),
    },
  });

  // Provisioning, e-invoice and the "ödeme alındı" notification are queued.
  await finalizeFulfilledInvoices([result]);

  return {
    success: true,
    // Payment recorded, but the order's activation needs the admin (see
    // /yonetim/provisioning).
    warning: result.fulfilled ? result.fulfilmentError : undefined,
    paymentId,
  };
}

/** Payment reminder (or overdue notice once past due) to the customer. */
export async function sendInvoiceReminderFor(id: string): Promise<{ success: true; message: string } | AdminInvoiceFailure> {
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
        },
      },
    },
  });

  if (!invoice) {
    return { success: false, error: "Fatura bulunamadı", status: 404 };
  }

  if (invoice.status === "PAID") {
    return { success: false, error: "Ödenmiş fatura için hatırlatma gönderilemez", status: 409 };
  }

  if (invoice.status === "CANCELLED") {
    return { success: false, error: "İptal edilmiş fatura için hatırlatma gönderilemez", status: 409 };
  }

  const isOverdue = invoice.status === "OVERDUE" || invoice.dueDate.getTime() < Date.now();
  const notice = {
    customer: {
      customerId: invoice.customer.id,
      email: invoice.customer.email,
      fullName: `${invoice.customer.name} ${invoice.customer.surname}`.trim(),
    },
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    totalAmount: Number(invoice.totalAmount),
    dueDate: invoice.dueDate,
  };

  await (isOverdue ? sendInvoiceOverdueEmail(notice) : sendInvoicePaymentReminderEmail(notice));

  return { success: true, message: "Hatırlatma gönderildi" };
}
