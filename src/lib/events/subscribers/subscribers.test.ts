import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dispatchOutboundWebhook: vi.fn(),
  enqueue: vi.fn(),
  sendNotification: vi.fn(),
  getAdminNotificationRecipients: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/integrations/webhooks/outbound", () => ({ dispatchOutboundWebhook: mocks.dispatchOutboundWebhook }));
vi.mock("@/lib/jobs/enqueue", () => ({ enqueue: mocks.enqueue }));
vi.mock("@/lib/notifications/send", () => ({ sendNotification: mocks.sendNotification }));
vi.mock("@/lib/provisioning/manual", () => ({ getAdminNotificationRecipients: mocks.getAdminNotificationRecipients }));

import { getEventDefinition, type EventType } from "../catalog";
import { adminAlertSubscriber } from "./admin-alert";
import { einvoiceSubscriber } from "./einvoice";
import { subscribersFor } from "./index";
import type { DispatchedEvent } from "./types";
import { toLegacyWebhook, webhooksSubscriber } from "./webhooks";

function event(type: EventType, payload: Record<string, unknown>): DispatchedEvent {
  return {
    id: "evt-1",
    type,
    payload: getEventDefinition(type).schema.parse(payload),
    aggregateType: "x",
    aggregateId: "x",
    actorId: null,
    occurredAt: new Date(),
  } as DispatchedEvent;
}

const paid = event("invoice.paid", {
  invoiceId: "inv-1",
  invoiceNumber: "F-1",
  customerId: "cus-1",
  amount: "199.99",
  paidAt: "2026-10-08T10:00:00.000Z",
  paymentReference: "pi_1",
  context: "order",
});

beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockReset()));

describe("subscriber routing", () => {
  it("invoice.paid reaches notifications, the bell, e-invoice, webhooks and activity log", () => {
    expect(subscribersFor("invoice.paid").map((s) => s.name)).toEqual(["notifications", "in-app", "einvoice", "webhooks", "activity-log"]);
    expect(subscribersFor("ticket.opened").map((s) => s.name)).toEqual(["in-app", "admin-alert"]);
  });
});

describe("webhooks subscriber", () => {
  it("keeps the legacy payment.completed contract for invoice.paid", () => {
    expect(toLegacyWebhook(paid)).toEqual({
      type: "payment.completed",
      payload: { invoiceId: "inv-1", invoiceNumber: "F-1", customerId: "cus-1", amount: 199.99, paymentReference: "pi_1", context: "order" },
    });
  });

  it("propagates a failed POST so the delivery is retried, and skips without a URL", async () => {
    mocks.dispatchOutboundWebhook.mockRejectedValueOnce(new Error("WEBHOOK_HTTP_500"));
    await expect(webhooksSubscriber.handle(paid)).rejects.toThrow("WEBHOOK_HTTP_500");
    mocks.dispatchOutboundWebhook.mockResolvedValueOnce({ sent: false, skipped: "NO_URL" });
    await expect(webhooksSubscriber.handle(paid)).resolves.toEqual({ skipped: "NO_URL" });
  });
});

describe("einvoice subscriber", () => {
  it("queues the idempotent efatura.issue job once per invoice", async () => {
    mocks.enqueue.mockResolvedValue({ id: "job-1", deduplicated: false });
    await einvoiceSubscriber.handle(paid);
    expect(mocks.enqueue).toHaveBeenCalledWith("efatura.issue", { invoiceId: "inv-1" }, { singletonKey: "inv-1" });
  });
});

describe("admin-alert subscriber", () => {
  it("mails the staff address once per event for a new ticket", async () => {
    mocks.getAdminNotificationRecipients.mockResolvedValue({ email: "ops@kleacore.test" });
    mocks.sendNotification.mockResolvedValue({ ok: true, logIds: ["log-1"], deduplicated: false });

    await adminAlertSubscriber.handle(
      event("ticket.opened", { ticketId: "t-1", ticketNumber: "T-1", subject: "Yardım", customerName: "Ayşe" })
    );

    expect(mocks.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "admin.event-alert",
        to: "ops@kleacore.test",
        dedupeKey: "admin-alert:evt-1",
        data: expect.objectContaining({ title: "Yeni destek talebi: T-1", path: "/yonetim/destek/t-1" }),
      })
    );
  });

  it("alerts admins about a failed backup / final backup (VM kept)", async () => {
    mocks.getAdminNotificationRecipients.mockResolvedValue({ email: "ops@kleacore.test" });
    mocks.sendNotification.mockResolvedValue({ ok: true, logIds: ["log-1"], deduplicated: false });

    await adminAlertSubscriber.handle(
      event("backup.failed", {
        backupId: "bk-1",
        serviceId: "svc-1",
        customerId: "cus-1",
        serviceLabel: "VDS Pro",
        trigger: "FINAL",
        operation: "backup",
        error: "PROXMOX_BACKUP: no space left",
      })
    );

    expect(subscribersFor("backup.failed").map((s) => s.name)).toContain("admin-alert");
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "admin.event-alert",
        data: expect.objectContaining({
          title: "Fesih öncesi son yedek başarısız: VDS Pro",
          path: "/yonetim/hizmetler/svc-1",
          message: expect.stringContaining("VM silinmedi"),
        }),
      })
    );
  });

  it("skips customer-initiated failed payments", async () => {
    const result = await adminAlertSubscriber.handle(event("payment.failed", { invoiceId: "inv-1", customerId: "cus-1" }));
    expect(result).toEqual({ skipped: "NOT_ALERTABLE" });
  });
});
