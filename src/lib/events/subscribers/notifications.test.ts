import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/payments/fulfillment", () => ({
  buildPaymentReceivedNotice: vi.fn(async (invoiceId: string) => ({
    userId: "cus-1",
    template: "billing.payment-received",
    data: { invoiceId, invoiceNumber: "F-1", paidAmount: 100, paidAt: new Date("2026-10-08T10:00:00Z") },
    dedupeKey: `payment.received:${invoiceId}`,
  })),
}));
vi.mock("@/lib/notifications/email", () => ({ loadSupportNotificationEmail: async () => "destek@kleacore.test" }));

import { DEFAULT_BRAND, renderNotification } from "@/lib/notifications/render";
import { getEventDefinition, type EventType } from "../catalog";
import { notificationPlanners, planNotifications } from "./notifications";
import type { DispatchedEvent } from "./types";

const ctx = { brand: DEFAULT_BRAND, baseUrl: "https://kleacore.test" };
const at = "2026-10-08T10:00:00.000Z";

/**
 * One sample per mapped event, with the template and dedupe key the direct
 * sendNotification call used before the outbox (behaviour must not change).
 */
const cases: Array<{ type: EventType; payload: Record<string, unknown>; template: string; dedupeKey: string | RegExp }> = [
  { type: "invoice.paid", payload: { invoiceId: "inv-1", invoiceNumber: "F-1", customerId: "cus-1", amount: "100", paidAt: at, context: "invoice" }, template: "billing.payment-received", dedupeKey: "payment.received:inv-1" },
  { type: "invoice.created", payload: { invoiceId: "inv-1", invoiceNumber: "F-1", customerId: "cus-1", totalAmount: "100", dueDate: at, source: "renewal" }, template: "billing.invoice-created", dedupeKey: "invoice.created:inv-1" },
  { type: "invoice.overdue", payload: { invoiceId: "inv-1", invoiceNumber: "F-1", customerId: "cus-1", totalAmount: "100", dueDate: at, suspendAfterDays: 3 }, template: "billing.invoice-overdue", dedupeKey: "invoice.overdue:inv-1" },
  { type: "payment.failed", payload: { invoiceId: "inv-1", invoiceNumber: "F-1", customerId: "cus-1", amount: "100", automatic: true }, template: "billing.payment-failed", dedupeKey: "payment.failed:evt-1" },
  { type: "payment.failed", payload: { invoiceId: "inv-1", invoiceNumber: "F-1", customerId: "cus-1", amount: "100", automatic: true, attemptId: "att-1", card: "Visa •••• 4242", attempt: 2, maxAttempts: 3, dueDate: at, reason: "Yetersiz bakiye" }, template: "billing.auto-charge-failed", dedupeKey: "auto-charge.failed:att-1" },
  { type: "refund.completed", payload: { refundId: "ref-1", invoiceId: "inv-1", invoiceNumber: "F-1", customerId: "cus-1", amount: "10.00", method: "CARD", refundedAt: at }, template: "billing.refund-issued", dedupeKey: "refund.issued:ref-1" },
  { type: "bank_transfer.approved", payload: { noticeId: "n-1", invoiceId: "inv-1", invoiceNumber: "F-1", customerId: "cus-1", amount: "100.00" }, template: "billing.bank-transfer-approved", dedupeKey: "bank-transfer.approved:n-1" },
  { type: "bank_transfer.rejected", payload: { noticeId: "n-1", invoiceId: "inv-1", invoiceNumber: "F-1", customerId: "cus-1", amount: "100.00", reason: "Ulaşmadı" }, template: "billing.bank-transfer-rejected", dedupeKey: "bank-transfer.rejected:n-1" },
  { type: "service.activated", payload: { serviceId: "svc-1", customerId: "cus-1", serviceLabel: "Hosting", kind: "hosting", nameservers: ["ns1.kleacore.com"], passwordDelivery: "panel" }, template: "service.activated", dedupeKey: "service.activated:svc-1" },
  { type: "service.suspended", payload: { serviceId: "svc-1", customerId: "cus-1", serviceLabel: "Hosting", reason: "Gecikmiş fatura ödemesi", suspendedAt: at }, template: "service.suspended", dedupeKey: "service.suspended:evt-1" },
  { type: "service.unsuspended", payload: { serviceId: "svc-1", customerId: "cus-1", serviceLabel: "Hosting" }, template: "service.unsuspended", dedupeKey: "service.unsuspended:evt-1" },
  { type: "domain.registered", payload: { domain: "ornek.com", customerId: "cus-1", orderId: "ord-1", expiresAt: at }, template: "domain.registered", dedupeKey: "domain.registered:ord-1" },
  { type: "domain.transferred", payload: { domain: "ornek.com", customerId: "cus-1", orderId: "ord-1" }, template: "domain.registered", dedupeKey: "domain.registered:ord-1" },
  { type: "domain.renewed", payload: { domainId: "dom-1", domain: "ornek.com", customerId: "cus-1", renewalId: "ren-1", years: 1, expiresAt: at }, template: "domain.renewed", dedupeKey: "domain.renewed:ren-1" },
  { type: "domain.expiring", payload: { domainId: "dom-1", domain: "ornek.com", customerId: "cus-1", kind: "expiring_7", daysLeft: 7, expiresAt: at, renewUrl: "https://kleacore.test/musteri/panel/domainler/dom-1" }, template: "domain.expiry-notice", dedupeKey: "domain.notice:dom-1:expiring_7:2026-10-08" },
  { type: "domain.expired", payload: { domainId: "dom-1", domain: "ornek.com", customerId: "cus-1", kind: "grace_ending", daysLeft: 0, expiresAt: at, renewUrl: "https://kleacore.test/x", stage: "grace_ending" }, template: "domain.expiry-notice", dedupeKey: "domain.notice:dom-1:grace_ending:2026-10-08" },
  { type: "domain.redemption", payload: { domainId: "dom-1", domain: "ornek.com", customerId: "cus-1", kind: "redemption", daysLeft: 0, expiresAt: at, renewUrl: "https://kleacore.test/x" }, template: "domain.expiry-notice", dedupeKey: "domain.notice:dom-1:redemption:2026-10-08" },
  { type: "ticket.replied", payload: { ticketId: "t-1", ticketNumber: "T-1", subject: "Konu", customerId: "cus-1", authorRole: "STAFF", senderName: "Destek", messagePreview: "Merhaba" }, template: "support.ticket-replied", dedupeKey: "ticket.replied:evt-1" },
  { type: "ticket.replied", payload: { ticketId: "t-1", ticketNumber: "T-1", subject: "Konu", customerId: "cus-1", authorRole: "CUSTOMER", senderName: "Ayşe", messagePreview: "Merhaba" }, template: "admin.ticket-customer-reply", dedupeKey: "ticket.replied:evt-1" },
  { type: "user.password_changed", payload: { userId: "cus-1", changedAt: at, method: "reset" }, template: "auth.password-changed", dedupeKey: "password.changed:evt-1" },
  { type: "user.two_factor_disabled", payload: { userId: "cus-1", disabledAt: at }, template: "auth.two-factor-disabled", dedupeKey: "two-factor.disabled:evt-1" },
  { type: "user.email_changed", payload: { userId: "cus-1", oldEmail: "eski@example.com", newEmail: "yeni@example.com", changedAt: at }, template: "auth.email-changed", dedupeKey: "email.changed:evt-1" },
  { type: "security.new_device_login", payload: { userId: "cus-1", loginEventId: "le-1", device: "Chrome · Windows", ipAddress: "203.0.113.5", network: "TR", occurredAt: at }, template: "security.new-device-login", dedupeKey: "security.new-device:le-1" },
  { type: "security.failed_login_burst", payload: { userId: "cus-1", failedAttempts: 5, windowMinutes: 60, lastAttemptAt: at }, template: "security.failed-login-burst", dedupeKey: "security.failed-burst:evt-1" },
  { type: "privacy.request_received", payload: { requestId: "dr-1", requestNumber: "KVKK-2026-000001", type: "EXPORT", userId: null, email: "ayse@example.com", name: "Ayşe", dueAt: at, source: "form" }, template: "privacy.request-received", dedupeKey: "privacy.received:dr-1" },
  { type: "privacy.request_completed", payload: { requestId: "dr-1", requestNumber: "KVKK-2026-000001", type: "EXPORT", userId: "cus-1", email: "ayse@example.com", name: "Ayşe", outcome: "COMPLETED", responseText: "Verileriniz hazır.", downloadUrl: "https://kleacore.test/yasal/kvkk-basvuru/indir?token=x", downloadExpiresAt: at }, template: "privacy.request-completed", dedupeKey: "privacy.completed:dr-1" },
];

function event(type: EventType, payload: Record<string, unknown>): DispatchedEvent {
  const parsed = getEventDefinition(type).schema.parse(payload);
  return { id: "evt-1", type, payload: parsed, aggregateType: "x", aggregateId: "x", actorId: null, occurredAt: new Date() } as DispatchedEvent;
}

describe("notifications subscriber", () => {
  it.each(cases)("$type → $template with the legacy dedupe key", async ({ type, payload, template, dedupeKey }) => {
    const planned = await planNotifications(event(type, payload));
    expect(planned).toHaveLength(1);
    expect(planned[0].template).toBe(template);
    expect(planned[0].dedupeKey).toEqual(dedupeKey);
    // The planned data is valid for the template (renders without throwing).
    expect(() => renderNotification(template, planned[0].data, ctx)).not.toThrow();
  });

  it("sends the e-mail change notice to the OLD address and KVKK mails to the request address", async () => {
    const [changed] = await planNotifications(
      event("user.email_changed", { userId: "cus-1", oldEmail: "eski@example.com", newEmail: "yeni@example.com", changedAt: at })
    );
    expect(changed.to).toBe("eski@example.com");
    const [received] = await planNotifications(
      event("privacy.request_received", {
        requestId: "dr-1",
        requestNumber: "KVKK-2026-000001",
        type: "ERASURE",
        email: "basvuru@example.com",
        name: "Ayşe",
        dueAt: at,
        source: "form",
      })
    );
    expect(received).toMatchObject({ to: "basvuru@example.com", userId: null, channel: "EMAIL" });
  });

  it("covers every mapped event type in the table above", () => {
    const tested = new Set(cases.map((item) => item.type));
    for (const type of Object.keys(notificationPlanners)) expect(tested.has(type as EventType)).toBe(true);
  });

  it("does not announce checkout invoices, zero totals or silenced events", async () => {
    const base = { invoiceId: "inv-1", invoiceNumber: "F-1", customerId: "cus-1", totalAmount: "100", dueDate: at };
    expect(await planNotifications(event("invoice.created", { ...base, source: "checkout" }))).toEqual([]);
    expect(await planNotifications(event("invoice.created", { ...base, totalAmount: "0.00" }))).toEqual([]);
    expect(await planNotifications(event("invoice.created", { ...base, notify: false }))).toEqual([]);
    expect(
      await planNotifications(
        event("service.suspended", { serviceId: "s", customerId: "c", serviceLabel: "x", reason: "r", suspendedAt: at, notify: false })
      )
    ).toEqual([]);
  });

  it("sends a customer reply to the support address", async () => {
    const [planned] = await planNotifications(
      event("ticket.replied", { ticketId: "t", ticketNumber: "T", subject: "s", authorRole: "CUSTOMER", senderName: "A", messagePreview: "m" })
    );
    expect(planned).toMatchObject({ to: "destek@kleacore.test", channel: "EMAIL" });
  });
});
