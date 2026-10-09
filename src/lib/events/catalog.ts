import { z } from "zod";

/**
 * Typed domain event catalogue (roadmap §4.3). Every event is written to the
 * outbox (DomainEvent) by `emitEvent` in the transaction of the business
 * change, then delivered to the subscribers in ./subscribers.
 *
 * Payload conventions: ids as strings, money as decimal strings (never used
 * for arithmetic by subscribers), dates as ISO strings. A schema's output must
 * be valid input again: the dispatcher re-parses the stored payload.
 */

const id = z.string().min(1);
/** Display money: number, Decimal string or Prisma Decimal → "599.94". */
const decimalLike = z.custom<{ toFixed(digits?: number): string }>(
  (value) => typeof value === "object" && value !== null && typeof (value as { toFixed?: unknown }).toFixed === "function"
);
const money = z.union([z.number(), z.string(), decimalLike]).transform((value) => String(value));
/** Date or ISO string → ISO string. */
const isoDate = z
  .union([z.date(), z.string()])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((value) => !Number.isNaN(value.getTime()), "Geçersiz tarih")
  .transform((value) => value.toISOString());

export type AggregateType =
  | "Order"
  | "Invoice"
  | "Payment"
  | "Service"
  | "Domain"
  | "Ticket"
  | "User"
  | "Refund"
  | "BankTransferNotice"
  | "Broadcast";

export interface EventDefinition<T extends string = string, S extends z.ZodTypeAny = z.ZodTypeAny> {
  type: T;
  /** Turkish label for /yonetim/olaylar. */
  label: string;
  aggregate: AggregateType;
  schema: S;
  /** Payload key holding the aggregate id. */
  aggregateKey: string;
  /** Payload keys holding secrets: encrypted in the outbox, never sent to webhooks. */
  sensitive?: readonly string[];
}

function defineEvent<const T extends string, S extends z.ZodTypeAny>(definition: EventDefinition<T, S>) {
  return definition;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

const orderCreated = defineEvent({
  type: "order.created",
  label: "Sipariş oluşturuldu",
  aggregate: "Order",
  aggregateKey: "orderId",
  schema: z.object({
    orderId: id,
    orderNumber: z.string(),
    customerId: id,
    totalAmount: money,
    invoiceId: id.optional(),
    paymentMethod: z.string().optional(),
  }),
});

const orderPaid = defineEvent({
  type: "order.paid",
  label: "Sipariş ödendi",
  aggregate: "Order",
  aggregateKey: "orderId",
  schema: z.object({
    orderId: id,
    orderNumber: z.string(),
    customerId: id,
    totalAmount: money,
    invoiceId: id.optional(),
  }),
});

const orderCancelled = defineEvent({
  type: "order.cancelled",
  label: "Sipariş iptal edildi",
  aggregate: "Order",
  aggregateKey: "orderId",
  schema: z.object({ orderId: id, orderNumber: z.string(), customerId: id, reason: z.string().optional() }),
});

// ---------------------------------------------------------------------------
// Invoices & payments
// ---------------------------------------------------------------------------

const invoiceShape = {
  invoiceId: id,
  invoiceNumber: z.string(),
  customerId: id,
};

const invoiceCreated = defineEvent({
  type: "invoice.created",
  label: "Fatura oluşturuldu",
  aggregate: "Invoice",
  aggregateKey: "invoiceId",
  schema: z.object({
    ...invoiceShape,
    totalAmount: money,
    dueDate: isoDate,
    /** Where it came from; checkout invoices are announced by "sipariş alındı". */
    source: z.enum(["checkout", "renewal", "domain_renewal", "admin", "other"]).default("other"),
    /** False: record the event only, no customer notice (e.g. zero-total). */
    notify: z.boolean().default(true),
  }),
});

const invoicePaid = defineEvent({
  type: "invoice.paid",
  label: "Fatura ödendi",
  aggregate: "Invoice",
  aggregateKey: "invoiceId",
  schema: z.object({
    ...invoiceShape,
    amount: money,
    paidAt: isoDate,
    paymentReference: z.string().optional(),
    /** What the payment settled (legacy "payment.completed" webhook field). */
    context: z.enum(["invoice", "order", "renewal"]),
  }),
});

const invoiceOverdue = defineEvent({
  type: "invoice.overdue",
  label: "Fatura gecikti",
  aggregate: "Invoice",
  aggregateKey: "invoiceId",
  schema: z.object({
    ...invoiceShape,
    totalAmount: money,
    dueDate: isoDate,
    suspendAfterDays: z.number().int().nonnegative().optional(),
  }),
});

const invoiceCancelled = defineEvent({
  type: "invoice.cancelled",
  label: "Fatura iptal edildi",
  aggregate: "Invoice",
  aggregateKey: "invoiceId",
  schema: z.object({ ...invoiceShape, reason: z.string().optional() }),
});

const invoiceRefundShape = {
  ...invoiceShape,
  refundId: id,
  amount: money,
  refundedTotal: money.optional(),
};

const invoiceRefunded = defineEvent({
  type: "invoice.refunded",
  label: "Fatura tamamen iade edildi",
  aggregate: "Invoice",
  aggregateKey: "invoiceId",
  schema: z.object(invoiceRefundShape),
});

const invoicePartiallyRefunded = defineEvent({
  type: "invoice.partially_refunded",
  label: "Fatura kısmen iade edildi",
  aggregate: "Invoice",
  aggregateKey: "invoiceId",
  schema: z.object(invoiceRefundShape),
});

const paymentFailed = defineEvent({
  type: "payment.failed",
  label: "Ödeme başarısız",
  aggregate: "Invoice",
  aggregateKey: "invoiceId",
  schema: z.object({
    invoiceId: id,
    invoiceNumber: z.string().optional(),
    customerId: id,
    amount: money.optional(),
    gateway: z.string().optional(),
    reason: z.string().optional(),
    /** Automatic charge of a stored card (3.7) vs. a customer attempt. */
    automatic: z.boolean().optional(),
    /** Stored-card charge details (3.7): PaymentAttempt id, masked card label, try n of max. */
    attemptId: z.string().optional(),
    card: z.string().optional(),
    attempt: z.number().int().optional(),
    maxAttempts: z.number().int().optional(),
    dueDate: isoDate.optional(),
  }),
});

const refundCompleted = defineEvent({
  type: "refund.completed",
  label: "İade tamamlandı",
  aggregate: "Refund",
  aggregateKey: "refundId",
  schema: z.object({
    refundId: id,
    invoiceId: id,
    invoiceNumber: z.string(),
    customerId: id,
    amount: money,
    /** CARD | BANK | BALANCE (template wording). */
    method: z.string().optional(),
    refundedAt: isoDate,
    reason: z.string().optional(),
  }),
});

const bankTransferShape = {
  noticeId: id,
  invoiceId: id,
  invoiceNumber: z.string(),
  customerId: id,
  amount: money,
};

const bankTransferSubmitted = defineEvent({
  type: "bank_transfer.submitted",
  label: "Havale bildirimi gönderildi",
  aggregate: "BankTransferNotice",
  aggregateKey: "noticeId",
  schema: z.object({ ...bankTransferShape, senderName: z.string().optional() }),
});

const bankTransferApproved = defineEvent({
  type: "bank_transfer.approved",
  label: "Havale bildirimi onaylandı",
  aggregate: "BankTransferNotice",
  aggregateKey: "noticeId",
  schema: z.object(bankTransferShape),
});

const bankTransferRejected = defineEvent({
  type: "bank_transfer.rejected",
  label: "Havale bildirimi reddedildi",
  aggregate: "BankTransferNotice",
  aggregateKey: "noticeId",
  schema: z.object({ ...bankTransferShape, reason: z.string().min(1) }),
});

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

const serviceShape = { serviceId: id, customerId: id, serviceLabel: z.string() };

const serviceActivated = defineEvent({
  type: "service.activated",
  label: "Hizmet aktifleştirildi",
  aggregate: "Service",
  aggregateKey: "serviceId",
  sensitive: ["password"],
  schema: z.object({
    ...serviceShape,
    kind: z.enum(["hosting", "server", "other"]),
    domain: z.string().optional(),
    username: z.string().optional(),
    panelUrl: z.string().optional(),
    nameservers: z.array(z.string()).optional(),
    ipAddress: z.string().optional(),
    hostname: z.string().optional(),
    password: z.string().optional(),
    passwordDelivery: z.enum(["included", "separately", "panel"]).optional(),
    notes: z.string().optional(),
  }),
});

const serviceSuspended = defineEvent({
  type: "service.suspended",
  label: "Hizmet askıya alındı",
  aggregate: "Service",
  aggregateKey: "serviceId",
  schema: z.object({
    ...serviceShape,
    reason: z.string(),
    suspendedAt: isoDate,
    invoiceId: id.optional(),
    /** False when the admin chose not to inform the customer. */
    notify: z.boolean().default(true),
  }),
});

const serviceUnsuspended = defineEvent({
  type: "service.unsuspended",
  label: "Hizmet askıdan çıkarıldı",
  aggregate: "Service",
  aggregateKey: "serviceId",
  schema: z.object({ ...serviceShape, notify: z.boolean().default(true) }),
});

const serviceTerminated = defineEvent({
  type: "service.terminated",
  label: "Hizmet sonlandırıldı",
  aggregate: "Service",
  aggregateKey: "serviceId",
  schema: z.object({ ...serviceShape, reason: z.string().optional(), terminatedAt: isoDate }),
});

const serviceRenewed = defineEvent({
  type: "service.renewed",
  label: "Hizmet yenilendi",
  aggregate: "Service",
  aggregateKey: "serviceId",
  schema: z.object({
    serviceId: id,
    customerId: id,
    newExpiryDate: isoDate,
    renewalMonths: z.number().int().positive(),
    invoiceId: id.optional(),
  }),
});

const servicePlanChanged = defineEvent({
  type: "service.plan_changed",
  label: "Hizmet paketi değişti",
  aggregate: "Service",
  aggregateKey: "serviceId",
  schema: z.object({
    serviceId: id,
    customerId: id,
    planChangeId: id,
    changeType: z.enum(["UPGRADE", "DOWNGRADE"]),
    invoiceId: id.optional(),
  }),
});

const serviceProvisioningFailed = defineEvent({
  type: "service.provisioning_failed",
  label: "Kurulum başarısız",
  aggregate: "Service",
  aggregateKey: "aggregateId",
  schema: z.object({
    /** Service id, else the order id when no service exists yet. */
    aggregateId: id,
    serviceId: id.optional(),
    orderId: id.optional(),
    orderNumber: z.string().optional(),
    customerId: id.optional(),
    provisioningJobId: id.optional(),
    error: z.string(),
  }),
});

// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------

const domainRegisteredShape = {
  domainId: id.optional(),
  domain: z.string(),
  customerId: id,
  orderId: id.optional(),
  expiresAt: isoDate.optional(),
  nameservers: z.array(z.string()).optional(),
};

const domainRegistered = defineEvent({
  type: "domain.registered",
  label: "Alan adı kaydedildi",
  aggregate: "Domain",
  aggregateKey: "domain",
  schema: z.object(domainRegisteredShape),
});

const domainTransferred = defineEvent({
  type: "domain.transferred",
  label: "Alan adı transfer edildi",
  aggregate: "Domain",
  aggregateKey: "domain",
  schema: z.object(domainRegisteredShape),
});

const domainRenewed = defineEvent({
  type: "domain.renewed",
  label: "Alan adı yenilendi",
  aggregate: "Domain",
  aggregateKey: "domainId",
  schema: z.object({
    domainId: id,
    domain: z.string(),
    customerId: id,
    renewalId: id,
    years: z.number().int().positive(),
    expiresAt: isoDate,
    invoiceId: id.nullable().optional(),
  }),
});

const domainNoticeShape = {
  domainId: id,
  domain: z.string(),
  customerId: id,
  /** DomainNotice kind (expiring_30 / expiring_7 / expiring_1 / expired / grace_ending / redemption). */
  kind: z.string(),
  daysLeft: z.number().int(),
  expiresAt: isoDate,
  graceEndsAt: isoDate.optional(),
  autoRenew: z.boolean().optional(),
  renewUrl: z.string().url(),
};

const domainExpiring = defineEvent({
  type: "domain.expiring",
  label: "Alan adı süresi doluyor",
  aggregate: "Domain",
  aggregateKey: "domainId",
  schema: z.object(domainNoticeShape),
});

const domainExpired = defineEvent({
  type: "domain.expired",
  label: "Alan adı süresi doldu",
  aggregate: "Domain",
  aggregateKey: "domainId",
  schema: z.object({ ...domainNoticeShape, stage: z.enum(["expired", "grace_ending"]).default("expired") }),
});

const domainRedemption = defineEvent({
  type: "domain.redemption",
  label: "Alan adı geri alma sürecinde",
  aggregate: "Domain",
  aggregateKey: "domainId",
  schema: z.object(domainNoticeShape),
});

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

const ticketShape = { ticketId: id, ticketNumber: z.string(), subject: z.string() };

const ticketOpened = defineEvent({
  type: "ticket.opened",
  label: "Destek talebi açıldı",
  aggregate: "Ticket",
  aggregateKey: "ticketId",
  schema: z.object({
    ...ticketShape,
    customerId: id.nullable().optional(),
    customerName: z.string().optional(),
    department: z.string().optional(),
    priority: z.string().optional(),
    messagePreview: z.string().optional(),
    /** "panel" | "email" (IMAP, 3.4) | "admin" */
    source: z.string().optional(),
  }),
});

const ticketReplied = defineEvent({
  type: "ticket.replied",
  label: "Destek talebi yanıtlandı",
  aggregate: "Ticket",
  aggregateKey: "ticketId",
  schema: z.object({
    ...ticketShape,
    customerId: id.nullable().optional(),
    /** STAFF → customer is notified; CUSTOMER → support staff is notified. */
    authorRole: z.enum(["STAFF", "CUSTOMER"]),
    /** Ticket department: picks the support mailbox used as Reply-To. */
    department: z.string().optional(),
    senderName: z.string(),
    messagePreview: z.string(),
    /** Recipient address override (customer without account / staff address). */
    recipientEmail: z.string().optional(),
    recipientName: z.string().optional(),
  }),
});

const ticketClosed = defineEvent({
  type: "ticket.closed",
  label: "Destek talebi kapandı",
  aggregate: "Ticket",
  aggregateKey: "ticketId",
  schema: z.object({
    ...ticketShape,
    customerId: id.nullable().optional(),
    /** "staff" | "customer" | "auto" */
    closedBy: z.string().optional(),
  }),
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const userRegistered = defineEvent({
  type: "user.registered",
  label: "Kullanıcı kaydoldu",
  aggregate: "User",
  aggregateKey: "userId",
  schema: z.object({ userId: id, email: z.string(), name: z.string().optional(), source: z.string().optional() }),
});

const userVerified = defineEvent({
  type: "user.verified",
  label: "E-posta doğrulandı",
  aggregate: "User",
  aggregateKey: "userId",
  schema: z.object({ userId: id, email: z.string().optional() }),
});

const userPasswordChanged = defineEvent({
  type: "user.password_changed",
  label: "Şifre değişti",
  aggregate: "User",
  aggregateKey: "userId",
  schema: z.object({ userId: id, changedAt: isoDate, method: z.enum(["reset", "profile", "admin"]) }),
});

const userLoginFailedLocked = defineEvent({
  type: "user.login_failed_locked",
  label: "Hesap başarısız girişler nedeniyle kilitlendi",
  aggregate: "User",
  aggregateKey: "userId",
  schema: z.object({
    userId: id,
    email: z.string().optional(),
    failedAttempts: z.number().int().optional(),
    lockedUntil: isoDate.optional(),
    ipAddress: z.string().optional(),
  }),
});

const userMarketingConsentChanged = defineEvent({
  type: "user.marketing_consent_changed",
  label: "Ticari ileti onayı değişti",
  aggregate: "User",
  aggregateKey: "userId",
  schema: z.object({
    userId: id,
    granted: z.boolean(),
    source: z.enum(["panel", "unsubscribe_link", "one_click", "admin"]),
  }),
});

// ---------------------------------------------------------------------------
// Broadcasts (toplu duyurular)
// ---------------------------------------------------------------------------

const broadcastStarted = defineEvent({
  type: "broadcast.started",
  label: "Toplu duyuru gönderimi başladı",
  aggregate: "Broadcast",
  aggregateKey: "broadcastId",
  schema: z.object({
    broadcastId: id,
    kind: z.enum(["SERVICE", "MARKETING"]),
    subject: z.string(),
    recipients: z.number().int(),
  }),
});

const broadcastCompleted = defineEvent({
  type: "broadcast.completed",
  label: "Toplu duyuru tamamlandı",
  aggregate: "Broadcast",
  aggregateKey: "broadcastId",
  schema: z.object({
    broadcastId: id,
    sent: z.number().int(),
    failed: z.number().int(),
    skipped: z.number().int(),
  }),
});

const broadcastCancelled = defineEvent({
  type: "broadcast.cancelled",
  label: "Toplu duyuru iptal edildi",
  aggregate: "Broadcast",
  aggregateKey: "broadcastId",
  schema: z.object({ broadcastId: id, cancelledRecipients: z.number().int() }),
});

export const eventDefinitions = [
  orderCreated,
  orderPaid,
  orderCancelled,
  invoiceCreated,
  invoicePaid,
  invoiceOverdue,
  invoiceCancelled,
  invoiceRefunded,
  invoicePartiallyRefunded,
  paymentFailed,
  refundCompleted,
  bankTransferSubmitted,
  bankTransferApproved,
  bankTransferRejected,
  serviceActivated,
  serviceSuspended,
  serviceUnsuspended,
  serviceTerminated,
  serviceRenewed,
  servicePlanChanged,
  serviceProvisioningFailed,
  domainRegistered,
  domainTransferred,
  domainRenewed,
  domainExpiring,
  domainExpired,
  domainRedemption,
  ticketOpened,
  ticketReplied,
  ticketClosed,
  userRegistered,
  userVerified,
  userPasswordChanged,
  userLoginFailedLocked,
  userMarketingConsentChanged,
  broadcastStarted,
  broadcastCompleted,
  broadcastCancelled,
] as const;

type Definitions = (typeof eventDefinitions)[number];
export type EventType = Definitions["type"];
/** What callers pass to emitEvent (money may be Decimal/number, dates Date). */
export type EventInput<T extends EventType> = z.input<Extract<Definitions, { type: T }>["schema"]>;
/** What subscribers receive (normalised: strings for money and dates). */
export type EventPayload<T extends EventType> = z.output<Extract<Definitions, { type: T }>["schema"]>;

const byType = new Map<string, EventDefinition>();
for (const definition of eventDefinitions) {
  if (byType.has(definition.type)) throw new Error(`Duplicate event type "${definition.type}"`);
  byType.set(definition.type, definition as unknown as EventDefinition);
}

export function getEventDefinition(type: string): EventDefinition {
  const definition = byType.get(type);
  if (!definition) throw new Error(`Unknown domain event: ${type}`);
  return definition;
}

export function isEventType(type: string): type is EventType {
  return byType.has(type);
}

export function listEventDefinitions(): EventDefinition[] {
  return [...byType.values()];
}

export function eventLabel(type: string) {
  return byType.get(type)?.label ?? type;
}
