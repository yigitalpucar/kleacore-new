import type { NotificationChannel, TicketDepartment } from "@prisma/client";
import type { EventPayload, EventType } from "../catalog";
import type { DispatchedEvent, EventSubscriber, SubscriberOutcome } from "./types";

/**
 * Event → customer/staff notification. Every mapping keeps the template and
 * the dedupe key the direct sendNotification call used before the outbox, so
 * a notice is never sent twice even when the old and new path overlap (the
 * hourly invoice sweep, a retried delivery). Mappings without a business key
 * dedupe on the event id.
 */

interface PlannedNotification {
  template: string;
  userId?: string | null;
  data: Record<string, unknown>;
  dedupeKey?: string;
  channel?: NotificationChannel;
  to?: string;
  phone?: string;
}

type Planner<T extends EventType> = (
  payload: EventPayload<T>,
  event: DispatchedEvent<T>
) => PlannedNotification[] | Promise<PlannedNotification[]>;

type PlannerMap = { [T in EventType]?: Planner<T> };

const DOMAIN_STAGE: Record<string, "expiring" | "expired" | "grace_ending" | "redemption"> = {
  expiring_30: "expiring",
  expiring_7: "expiring",
  expiring_1: "expiring",
  expired: "expired",
  grace_ending: "grace_ending",
  redemption: "redemption",
};

function domainNotice(payload: EventPayload<"domain.expiring">): PlannedNotification[] {
  return [
    {
      template: "domain.expiry-notice",
      userId: payload.customerId,
      data: {
        domain: payload.domain,
        daysLeft: payload.daysLeft,
        expiresAt: payload.expiresAt,
        stage: DOMAIN_STAGE[payload.kind] ?? "expiring",
        graceEndsAt: payload.graceEndsAt,
        autoRenew: payload.autoRenew,
        renewUrl: payload.renewUrl,
      },
      dedupeKey: `domain.notice:${payload.domainId}:${payload.kind}:${payload.expiresAt.slice(0, 10)}`,
    },
  ];
}

function domainRegistered(
  payload: EventPayload<"domain.registered">,
  event: { id: string },
  transfer: boolean
): PlannedNotification[] {
  return [
    {
      template: "domain.registered",
      userId: payload.customerId,
      data: {
        domain: payload.domain,
        expiresAt: payload.expiresAt,
        nameservers: payload.nameservers,
        transfer,
      },
      dedupeKey: `domain.registered:${payload.orderId ?? event.id}`,
    },
  ];
}

/** Zero-total invoices are never announced (same rule as the hourly invoice sweep). */
function isZeroAmount(value: string) {
  return Number(value) === 0;
}

export const notificationPlanners: PlannerMap = {
  "invoice.paid": async (payload) => {
    // Reads the invoice again: a refund/cancel before delivery skips the notice.
    const { buildPaymentReceivedNotice } = await import("@/lib/payments/fulfillment");
    const notice = await buildPaymentReceivedNotice(payload.invoiceId);
    return notice ? [notice] : [];
  },

  "invoice.created": (payload) =>
    payload.notify && payload.source !== "checkout" && !isZeroAmount(payload.totalAmount)
      ? [
          {
            template: "billing.invoice-created",
            userId: payload.customerId,
            data: {
              invoiceId: payload.invoiceId,
              invoiceNumber: payload.invoiceNumber,
              totalAmount: payload.totalAmount,
              dueDate: payload.dueDate,
            },
            dedupeKey: `invoice.created:${payload.invoiceId}`,
          },
        ]
      : [],

  "invoice.overdue": (payload) => isZeroAmount(payload.totalAmount) ? [] : [
    {
      template: "billing.invoice-overdue",
      userId: payload.customerId,
      data: {
        invoiceId: payload.invoiceId,
        invoiceNumber: payload.invoiceNumber,
        totalAmount: payload.totalAmount,
        dueDate: payload.dueDate,
        ...(payload.suspendAfterDays !== undefined ? { suspendAfterDays: payload.suspendAfterDays } : {}),
      },
      dedupeKey: `invoice.overdue:${payload.invoiceId}`,
    },
  ],

  "payment.failed": (payload, event) => {
    // A failed automatic charge of a stored card has its own template
    // (card, try n of max); one mail per PaymentAttempt.
    if (payload.automatic && payload.attemptId && payload.invoiceNumber && payload.amount && payload.dueDate) {
      return [
        {
          template: "billing.auto-charge-failed",
          userId: payload.customerId,
          data: {
            invoiceId: payload.invoiceId,
            invoiceNumber: payload.invoiceNumber,
            amount: payload.amount,
            dueDate: payload.dueDate,
            card: payload.card || "Kayıtlı kart",
            reason: payload.reason?.slice(0, 200) || undefined,
            attempt: Math.max(1, Math.min(payload.attempt ?? 1, payload.maxAttempts ?? 1)),
            maxAttempts: Math.max(1, payload.maxAttempts ?? 1),
          },
          dedupeKey: `auto-charge.failed:${payload.attemptId}`,
        },
      ];
    }
    return [
      {
        template: "billing.payment-failed",
        userId: payload.customerId,
        data: {
          invoiceId: payload.invoiceId,
          invoiceNumber: payload.invoiceNumber,
          amount: payload.amount,
          reason: payload.reason,
          automatic: payload.automatic,
        },
        dedupeKey: `payment.failed:${event.id}`,
      },
    ];
  },

  "refund.completed": (payload) => [
    {
      template: "billing.refund-issued",
      userId: payload.customerId,
      data: {
        invoiceId: payload.invoiceId,
        invoiceNumber: payload.invoiceNumber,
        amount: payload.amount,
        method: payload.method,
        refundedAt: payload.refundedAt,
        reason: payload.reason,
      },
      dedupeKey: `refund.issued:${payload.refundId}`,
    },
  ],

  "bank_transfer.approved": (payload) => [
    {
      template: "billing.bank-transfer-approved",
      userId: payload.customerId,
      data: { invoiceId: payload.invoiceId, invoiceNumber: payload.invoiceNumber, amount: payload.amount },
      dedupeKey: `bank-transfer.approved:${payload.noticeId}`,
    },
  ],

  "bank_transfer.rejected": (payload) => [
    {
      template: "billing.bank-transfer-rejected",
      userId: payload.customerId,
      data: {
        invoiceId: payload.invoiceId,
        invoiceNumber: payload.invoiceNumber,
        amount: payload.amount,
        reason: payload.reason,
      },
      dedupeKey: `bank-transfer.rejected:${payload.noticeId}`,
    },
  ],

  "order.review_required": (payload) => [
    {
      template: "order.review-pending",
      userId: payload.customerId,
      data: { orderNumber: payload.orderNumber, paymentBlocked: payload.paymentBlocked },
      // One "inceleniyor" mail per order, even if checkout and payment both flag it.
      dedupeKey: `order.review-pending:${payload.orderId}`,
    },
  ],

  "order.review_approved": (payload) => [
    {
      template: "order.review-approved",
      userId: payload.customerId,
      data: { orderNumber: payload.orderNumber, paid: payload.paid },
      dedupeKey: `order.review-approved:${payload.orderId}`,
    },
  ],

  "order.review_rejected": (payload) => [
    {
      template: "order.review-rejected",
      userId: payload.customerId,
      data: { orderNumber: payload.orderNumber, reason: payload.reason?.slice(0, 500), paid: payload.paid },
      dedupeKey: `order.review-rejected:${payload.orderId}`,
    },
  ],

  "kyc.required": (payload) => [
    {
      template: "kyc.verification-required",
      userId: payload.userId,
      data: { orderNumber: payload.orderNumber, productName: payload.productName },
      dedupeKey: `kyc.required:${payload.orderId}`,
    },
  ],

  "kyc.approved": (payload, event) => [
    {
      template: "kyc.approved",
      userId: payload.userId,
      data: { releasedOrders: payload.releasedOrders },
      dedupeKey: `kyc.approved:${event.id}`,
    },
  ],

  "kyc.rejected": (payload, event) => [
    {
      template: "kyc.rejected",
      userId: payload.userId,
      data: { reason: payload.reason.slice(0, 500) },
      dedupeKey: `kyc.rejected:${event.id}`,
    },
  ],

  "service.activated": (payload) => [
    {
      template: "service.activated",
      userId: payload.customerId,
      data: {
        serviceId: payload.serviceId,
        serviceLabel: payload.serviceLabel,
        kind: payload.kind,
        domain: payload.domain,
        username: payload.username,
        panelUrl: payload.panelUrl,
        nameservers: payload.nameservers,
        ipAddress: payload.ipAddress,
        hostname: payload.hostname,
        password: payload.password,
        passwordDelivery: payload.passwordDelivery,
        notes: payload.notes,
      },
      dedupeKey: `service.activated:${payload.serviceId}`,
    },
  ],

  "service.suspended": (payload, event) =>
    payload.notify
      ? [
          {
            template: "service.suspended",
            userId: payload.customerId,
            data: {
              serviceId: payload.serviceId,
              serviceLabel: payload.serviceLabel.trim() || "Hizmetiniz",
              reason: payload.reason,
              suspendedAt: payload.suspendedAt,
            },
            dedupeKey: `service.suspended:${event.id}`,
          },
        ]
      : [],

  "service.unsuspended": (payload, event) =>
    payload.notify
      ? [
          {
            template: "service.unsuspended",
            userId: payload.customerId,
            data: { serviceId: payload.serviceId, serviceLabel: payload.serviceLabel },
            dedupeKey: `service.unsuspended:${event.id}`,
          },
        ]
      : [],

  "backup.completed": (payload) =>
    payload.notifyCustomer && payload.trigger !== "FINAL"
      ? [
          {
            template: "service.backup-completed",
            userId: payload.customerId,
            data: {
              serviceId: payload.serviceId,
              serviceLabel: payload.serviceLabel,
              trigger: payload.trigger,
              sizeMB: payload.sizeMB,
              completedAt: payload.completedAt,
            },
            dedupeKey: `backup.completed:${payload.backupId}`,
          },
        ]
      : [],

  "backup.failed": (payload, event) =>
    payload.notifyCustomer && payload.trigger !== "FINAL"
      ? [
          {
            template: "service.backup-failed",
            userId: payload.customerId,
            data: { serviceId: payload.serviceId, serviceLabel: payload.serviceLabel, operation: payload.operation },
            dedupeKey: `backup.failed:${payload.backupId}:${payload.operation}:${event.id}`,
          },
        ]
      : [],

  "backup.restored": (payload, event) =>
    payload.notifyCustomer
      ? [
          {
            template: "service.backup-restored",
            userId: payload.customerId,
            data: { serviceId: payload.serviceId, serviceLabel: payload.serviceLabel, backupCreatedAt: payload.backupCreatedAt },
            dedupeKey: `backup.restored:${event.id}`,
          },
        ]
      : [],

  "domain.registered": (payload, event) => domainRegistered(payload, event, false),
  "domain.transferred": (payload, event) => domainRegistered(payload, event, true),

  "domain.renewed": (payload) => [
    {
      template: "domain.renewed",
      userId: payload.customerId,
      data: { domain: payload.domain, years: payload.years, expiresAt: payload.expiresAt },
      dedupeKey: `domain.renewed:${payload.renewalId}`,
    },
  ],

  "domain.expiring": (payload) => domainNotice(payload),
  "domain.expired": (payload) => domainNotice(payload),
  "domain.redemption": (payload) => domainNotice(payload),

  "ticket.replied": async (payload, event) => {
    const data = {
      ticketId: payload.ticketId,
      ticketNumber: payload.ticketNumber,
      ticketSubject: payload.subject,
      senderName: payload.senderName,
      messagePreview: payload.messagePreview,
    };
    if (payload.authorRole === "CUSTOMER") {
      const { loadSupportNotificationEmail } = await import("@/lib/notifications/email");
      const to = payload.recipientEmail || (await loadSupportNotificationEmail());
      if (!to) return [];
      return [{ template: "admin.ticket-customer-reply", data, to, channel: "EMAIL", dedupeKey: `ticket.replied:${event.id}` }];
    }
    // Reply-To = the polled support mailbox, so the customer can answer by e-mail.
    const { supportReplyAddress } = await import("@/lib/support/tickets");
    const replyTo = await supportReplyAddress(payload.department as TicketDepartment | undefined).catch(() => undefined);
    return [
      {
        template: "support.ticket-replied",
        userId: payload.customerId ?? null,
        data: { ...data, recipientName: payload.recipientName, ...(replyTo ? { replyTo } : {}) },
        to: payload.customerId ? undefined : payload.recipientEmail,
        channel: "EMAIL",
        dedupeKey: `ticket.replied:${event.id}`,
      },
    ];
  },

  "user.password_changed": (payload, event) => [
    {
      template: "auth.password-changed",
      userId: payload.userId,
      data: { changedAt: payload.changedAt, method: payload.method },
      dedupeKey: `password.changed:${event.id}`,
    },
  ],

  "user.two_factor_disabled": (payload, event) => [
    {
      template: "auth.two-factor-disabled",
      userId: payload.userId,
      data: { disabledAt: payload.disabledAt, by: payload.by },
      dedupeKey: `two-factor.disabled:${event.id}`,
    },
  ],

  // To the OLD address: the account (and so userId's e-mail) already has the new one.
  "user.email_changed": (payload, event) => [
    {
      template: "auth.email-changed",
      userId: payload.userId,
      to: payload.oldEmail,
      channel: "EMAIL",
      data: { oldEmail: payload.oldEmail, newEmail: payload.newEmail, changedAt: payload.changedAt },
      dedupeKey: `email.changed:${event.id}`,
    },
  ],

  "security.new_device_login": (payload) => [
    {
      template: "security.new-device-login",
      userId: payload.userId,
      data: {
        device: payload.device,
        ipAddress: payload.ipAddress,
        network: payload.network,
        occurredAt: payload.occurredAt,
        twoFactorUsed: payload.twoFactorUsed,
      },
      dedupeKey: `security.new-device:${payload.loginEventId}`,
    },
  ],

  "security.failed_login_burst": (payload, event) => [
    {
      template: "security.failed-login-burst",
      userId: payload.userId,
      channel: "EMAIL",
      data: {
        failedAttempts: payload.failedAttempts,
        windowMinutes: payload.windowMinutes,
        lastIpAddress: payload.lastIpAddress,
        lastAttemptAt: payload.lastAttemptAt,
      },
      dedupeKey: `security.failed-burst:${event.id}`,
    },
  ],

  // Requester may have no account: always the address on the request.
  "privacy.request_received": (payload) => [
    {
      template: "privacy.request-received",
      userId: payload.userId ?? null,
      to: payload.email,
      channel: "EMAIL",
      data: { recipientName: payload.name, requestNumber: payload.requestNumber, type: payload.type, dueAt: payload.dueAt },
      dedupeKey: `privacy.received:${payload.requestId}`,
    },
  ],

  "privacy.request_completed": (payload) => [
    {
      template: "privacy.request-completed",
      userId: payload.userId ?? null,
      to: payload.email,
      channel: "EMAIL",
      data: {
        recipientName: payload.name,
        requestNumber: payload.requestNumber,
        type: payload.type,
        outcome: payload.outcome,
        responseText: payload.responseText,
        downloadUrl: payload.downloadUrl,
        downloadExpiresAt: payload.downloadExpiresAt,
      },
      dedupeKey: `privacy.completed:${payload.requestId}`,
    },
  ],
};

export async function planNotifications(event: DispatchedEvent): Promise<PlannedNotification[]> {
  const planner = notificationPlanners[event.type] as Planner<EventType> | undefined;
  if (!planner) return [];
  return planner(event.payload as EventPayload<EventType>, event as DispatchedEvent<EventType>);
}

export const notificationsSubscriber: EventSubscriber = {
  name: "notifications",
  label: "Bildirimler (e-posta / SMS)",
  handles: (type) => type in notificationPlanners,
  async handle(event): Promise<SubscriberOutcome> {
    const planned = await planNotifications(event);
    if (planned.length === 0) return { skipped: "NO_NOTIFICATION" };

    const { sendNotification } = await import("@/lib/notifications/send");
    const logIds: string[] = [];
    let deduplicated = 0;
    for (const item of planned) {
      const result = await sendNotification({ ...item, template: item.template as never, data: item.data as never });
      // Not queued (bad data, DB error): throw so the delivery is retried.
      // Already-queued siblings are protected by their dedupe keys.
      if (!result.ok) throw new Error(`${item.template}: ${result.error ?? "NOTIFICATION_NOT_QUEUED"}`);
      logIds.push(...result.logIds);
      if (result.deduplicated) deduplicated += 1;
    }
    return { templates: planned.map((item) => item.template), logIds, deduplicated };
  },
};
