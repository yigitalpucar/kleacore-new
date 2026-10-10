import type { NotificationType } from "@prisma/client";
import { db } from "@/lib/db";
import { hasPermission, STAFF_ROLES, type Permission } from "@/lib/auth/permissions";
import { formatTRY } from "@/lib/format/price";
import type { EventType } from "../catalog";
import type { DispatchedEvent, EventSubscriber } from "./types";
import { isEvent } from "./types";

/**
 * In-app notification bell (customer panel + admin top bar). One Notification
 * row per recipient, keyed `event:<eventId>` so a retried delivery never adds
 * a second row (unique userId + dedupeKey, createMany skipDuplicates).
 *
 * Customers get their own business events; staff get work items, filtered by
 * the permission that opens the linked page (a BILLING user never sees a
 * ticket bell item they could not open).
 */

export type InAppAudience =
  | { kind: "customer"; userId: string }
  | {
      kind: "staff";
      permission: Permission;
      /** Ticket whose assignee (if any) is the only staff recipient. */
      ticketId?: string;
      /** Never notify this user (the staff member who caused the event). */
      excludeUserId?: string | null;
    };

export interface InAppPlan {
  audience: InAppAudience;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
}

const C = "/musteri/panel";
const A = "/yonetim";

const money = (value: string | undefined) => (value ? formatTRY(Number(value), { keepDecimals: true }) : null);
const isZero = (value: string | undefined) => value !== undefined && Number(value) === 0;
const clip = (text: string, max = 160) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** What to show for an event; [] = nothing for the bell. Pure (unit-tested). */
export function planInAppNotifications(event: DispatchedEvent): InAppPlan[] {
  // ---------------------------------------------------------------- customer
  if (isEvent(event, "invoice.created")) {
    const p = event.payload;
    // Same rule as the e-mail: checkout invoices are announced by the order flow.
    if (!p.notify || p.source === "checkout" || isZero(p.totalAmount)) return [];
    return [
      {
        audience: { kind: "customer", userId: p.customerId },
        type: "INFO",
        title: `Yeni fatura: ${p.invoiceNumber}`,
        message: `${money(p.totalAmount)} tutarında yeni bir faturanız oluşturuldu.`,
        link: `${C}/faturalar/${p.invoiceId}`,
      },
    ];
  }
  if (isEvent(event, "invoice.paid")) {
    const p = event.payload;
    return [
      {
        audience: { kind: "customer", userId: p.customerId },
        type: "SUCCESS",
        title: `Ödemeniz alındı: ${p.invoiceNumber}`,
        message: `${money(p.amount)} tutarındaki ödemeniz için teşekkür ederiz.`,
        link: `${C}/faturalar/${p.invoiceId}`,
      },
    ];
  }
  if (isEvent(event, "service.activated")) {
    const p = event.payload;
    return [
      {
        audience: { kind: "customer", userId: p.customerId },
        type: "SUCCESS",
        title: "Hizmetiniz hazır",
        message: `${p.serviceLabel}${p.domain ? ` (${p.domain})` : ""} kullanıma açıldı.`,
        link: `${C}/hizmetlerim/${p.serviceId}`,
      },
    ];
  }
  if (isEvent(event, "service.suspended")) {
    const p = event.payload;
    if (!p.notify) return [];
    return [
      {
        audience: { kind: "customer", userId: p.customerId },
        type: "WARNING",
        title: "Hizmetiniz askıya alındı",
        message: clip(`${p.serviceLabel}: ${p.reason}`),
        link: p.invoiceId ? `${C}/faturalar/${p.invoiceId}` : `${C}/hizmetlerim/${p.serviceId}`,
      },
    ];
  }
  if (isEvent(event, "ticket.replied")) {
    const p = event.payload;
    if (p.authorRole === "STAFF") {
      if (!p.customerId) return []; // guest ticket: e-mail only
      return [
        {
          audience: { kind: "customer", userId: p.customerId },
          type: "INFO",
          title: `Destek talebiniz yanıtlandı: ${p.ticketNumber}`,
          message: clip(p.messagePreview || p.subject),
          link: `${C}/destek/${p.ticketId}`,
        },
      ];
    }
    return [
      {
        audience: { kind: "staff", permission: "tickets.view", ticketId: p.ticketId },
        type: "INFO",
        title: `Müşteri yanıtı: ${p.ticketNumber}`,
        message: clip(`${p.senderName}: ${p.messagePreview || p.subject}`),
        link: `${A}/destek/${p.ticketId}`,
      },
    ];
  }

  // ------------------------------------------------------------------- staff
  if (isEvent(event, "ticket.opened")) {
    const p = event.payload;
    if (p.source === "admin") return []; // opened by staff on the customer's behalf
    return [
      {
        audience: { kind: "staff", permission: "tickets.view" },
        type: "INFO",
        title: `Yeni destek talebi: ${p.ticketNumber}`,
        message: clip(`${p.customerName ?? "Bir müşteri"}: ${p.subject}`),
        link: `${A}/destek/${p.ticketId}`,
      },
    ];
  }
  if (isEvent(event, "order.created")) {
    const p = event.payload;
    return [
      {
        audience: { kind: "staff", permission: "orders.view", excludeUserId: event.actorId },
        type: "INFO",
        title: `Yeni sipariş: ${p.orderNumber}`,
        message: `${money(p.totalAmount)} tutarında yeni bir sipariş alındı.`,
        link: `${A}/siparisler/${p.orderId}`,
      },
    ];
  }
  if (isEvent(event, "payment.failed")) {
    const p = event.payload;
    const amount = money(p.amount);
    return [
      {
        audience: { kind: "staff", permission: "invoices.view" },
        type: "ERROR",
        title: `${p.automatic ? "Otomatik tahsilat" : "Ödeme"} başarısız${p.invoiceNumber ? `: ${p.invoiceNumber}` : ""}`,
        message: clip([amount, p.reason].filter(Boolean).join(" · ") || "Ödeme denemesi başarısız oldu."),
        link: `${A}/faturalar/${p.invoiceId}`,
      },
    ];
  }
  if (isEvent(event, "kyc.submitted")) {
    const p = event.payload;
    return [
      {
        audience: { kind: "staff", permission: "kyc.review" },
        type: "WARNING",
        title: "Kimlik doğrulaması inceleme bekliyor",
        message: `${p.customerName ?? "Bir müşteri"} kimlik belgelerini yükledi.`,
        link: `${A}/kyc/${p.userId}`,
      },
    ];
  }
  return [];
}

export const IN_APP_EVENTS: readonly EventType[] = [
  "invoice.created",
  "invoice.paid",
  "service.activated",
  "service.suspended",
  "ticket.replied",
  "ticket.opened",
  "order.created",
  "payment.failed",
  "kyc.submitted",
];

/** Active staff holding `permission` (ADMIN holds all). */
export async function staffWithPermission(permission: Permission) {
  const staff = await db.user.findMany({
    where: { role: { in: [...STAFF_ROLES] }, status: "ACTIVE" },
    select: { id: true, role: true },
  });
  return staff.filter((u) => hasPermission(u.role, permission)).map((u) => u.id);
}

async function resolveRecipients(audience: InAppAudience): Promise<string[]> {
  if (audience.kind === "customer") {
    const user = await db.user.findUnique({ where: { id: audience.userId }, select: { id: true } });
    return user ? [user.id] : [];
  }
  let ids = await staffWithPermission(audience.permission);
  if (audience.ticketId) {
    const ticket = await db.supportTicket.findUnique({ where: { id: audience.ticketId }, select: { assignedTo: true } });
    if (ticket?.assignedTo && ids.includes(ticket.assignedTo)) ids = [ticket.assignedTo];
  }
  if (audience.excludeUserId) ids = ids.filter((id) => id !== audience.excludeUserId);
  return ids;
}

export const inAppNotificationsSubscriber: EventSubscriber = {
  name: "in-app",
  label: "Panel bildirimi",
  handles: (type) => IN_APP_EVENTS.includes(type),
  async handle(event) {
    const plans = planInAppNotifications(event);
    if (plans.length === 0) return { skipped: "NOT_NOTIFIABLE" };

    const rows = [];
    for (const plan of plans) {
      for (const userId of await resolveRecipients(plan.audience)) {
        rows.push({
          userId,
          type: plan.type,
          title: plan.title,
          message: plan.message,
          link: plan.link,
          kind: event.type,
          dedupeKey: `event:${event.id}`,
        });
      }
    }
    if (rows.length === 0) return { skipped: "NO_RECIPIENT" };
    const created = await db.notification.createMany({ data: rows, skipDuplicates: true });
    return { recipients: rows.length, created: created.count };
  },
};
