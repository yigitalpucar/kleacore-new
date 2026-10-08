import type { NotificationChannel } from "@prisma/client";
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

  "payment.failed": (payload, event) => [
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
  ],

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
    return [
      {
        template: "support.ticket-replied",
        userId: payload.customerId ?? null,
        data: { ...data, recipientName: payload.recipientName },
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
