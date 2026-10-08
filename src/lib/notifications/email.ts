/**
 * Legacy notification helpers, kept so existing call sites stay unchanged.
 * Each one is now a thin wrapper over `sendNotification` (typed templates +
 * NotificationLog + "notification.send" queue job) or, for business events,
 * over `emitEvent` (outbox). New code should emit a domain event
 * (src/lib/events) or call `sendNotification` directly.
 */
import type { PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { toNumber, type MoneyInput } from "@/lib/money";
import { sendNotification } from "./send";

interface CustomerRecipient {
  customerId: string;
  email: string;
  fullName?: string;
}

export interface OrderConfirmationEmailInput {
  customer: CustomerRecipient;
  orderNumbers: string[];
  totalAmount: MoneyInput;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  promoCode?: string;
}

export interface PaymentReceivedEmailInput {
  customer: CustomerRecipient;
  invoiceId: string;
  invoiceNumber: string;
  paidAmount: MoneyInput;
  paidAt: Date;
}

export interface InvoiceEmailInput {
  customer: CustomerRecipient;
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: MoneyInput;
  dueDate: Date;
}

export type InvoiceOverdueEmailInput = InvoiceEmailInput;
export type InvoicePaymentReminderEmailInput = InvoiceEmailInput;

export interface TicketReplyEmailInput {
  recipientEmail: string;
  recipientName?: string;
  ticketId: string;
  ticketNumber: string;
  ticketSubject: string;
  senderName: string;
  messagePreview: string;
  recipientRole: "CUSTOMER" | "ADMIN";
  customerId?: string;
}

export interface AffiliatePayoutCompletedEmailInput {
  customer: CustomerRecipient;
  paymentId: string;
  amount: MoneyInput;
  paidAt: Date;
}

const amount = (value: MoneyInput) => toNumber(value);

export function dispatchNotification(task: () => Promise<unknown>) {
  void task().catch((error) => {
    console.error("[Notifications] Bildirim kuyruğa alınamadı:", error);
  });
}

export async function sendOrderConfirmationEmail(input: OrderConfirmationEmailInput) {
  return sendNotification({
    userId: input.customer.customerId,
    template: "billing.order-received",
    data: {
      orderNumbers: input.orderNumbers,
      totalAmount: amount(input.totalAmount),
      paymentMethod: input.paymentMethod,
      isPaid: input.isPaid,
      promoCode: input.promoCode,
    },
    dedupeKey: `order.received:${[...input.orderNumbers].sort().join(",")}`,
  });
}

export async function sendPaymentReceivedEmail(input: PaymentReceivedEmailInput) {
  return sendNotification({
    userId: input.customer.customerId,
    template: "billing.payment-received",
    data: {
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      paidAmount: amount(input.paidAmount),
      paidAt: input.paidAt,
    },
    dedupeKey: `payment.received:${input.invoiceId}`,
  });
}

function invoiceData(input: InvoiceEmailInput) {
  return {
    invoiceId: input.invoiceId,
    invoiceNumber: input.invoiceNumber,
    totalAmount: amount(input.totalAmount),
    dueDate: input.dueDate,
  };
}

/** Manual reminder from the admin invoice screen: not deduplicated on purpose. */
export async function sendInvoicePaymentReminderEmail(input: InvoicePaymentReminderEmailInput) {
  return sendNotification({
    userId: input.customer.customerId,
    template: "billing.invoice-reminder",
    data: invoiceData(input),
    channel: "EMAIL",
  });
}

/** Manual reminder from the admin invoice screen: not deduplicated on purpose. */
export async function sendInvoiceOverdueEmail(input: InvoiceOverdueEmailInput) {
  return sendNotification({
    userId: input.customer.customerId,
    template: "billing.invoice-overdue",
    data: invoiceData(input),
    channel: "EMAIL",
  });
}

/**
 * Records ticket.replied (outbox); the notifications subscriber sends
 * "destek talebiniz yanıtlandı" to the customer (staff reply) or the
 * customer's reply to the support address (customer reply).
 */
export async function sendTicketReplyEmail(input: TicketReplyEmailInput) {
  const { emitEvent } = await import("@/lib/events/emit");
  return emitEvent(
    db,
    "ticket.replied",
    {
      ticketId: input.ticketId,
      ticketNumber: input.ticketNumber,
      subject: input.ticketSubject,
      customerId: input.customerId ?? null,
      authorRole: input.recipientRole === "ADMIN" ? "CUSTOMER" : "STAFF",
      senderName: input.senderName,
      messagePreview: input.messagePreview,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
    }
  );
}

export async function sendAffiliatePayoutCompletedEmail(input: AffiliatePayoutCompletedEmailInput) {
  return sendNotification({
    userId: input.customer.customerId,
    template: "affiliate.payout-completed",
    data: { paymentId: input.paymentId, amount: amount(input.amount), paidAt: input.paidAt },
    dedupeKey: `affiliate.payout:${input.paymentId}`,
  });
}

/** Staff address for support/admin notifications. */
export async function loadSupportNotificationEmail() {
  const settings = await db.setting.findMany({
    where: { key: { in: ["support_email", "company_email"] } },
    select: { key: true, value: true },
  });
  const value = (key: string) => settings.find((setting) => setting.key === key)?.value?.trim();
  return value("support_email") || value("company_email") || process.env.SMTP_FROM || process.env.EMAIL_FROM || null;
}

export async function loadCustomerRecipient(customerId: string) {
  const customer = await db.user.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      email: true,
      name: true,
      surname: true,
    },
  });

  if (!customer) {
    return null;
  }

  return {
    customerId: customer.id,
    email: customer.email,
    fullName: `${customer.name ?? ""} ${customer.surname ?? ""}`.trim(),
  };
}
