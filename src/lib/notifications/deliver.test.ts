import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  settingFindMany: vi.fn(),
  sendTransactionalEmail: vi.fn(),
  sendSms: vi.fn(),
  recordBroadcastDelivery: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    notificationLog: { findUnique: mocks.findUnique, update: mocks.update },
    setting: { findMany: mocks.settingFindMany },
  },
}));
vi.mock("@/lib/mail", () => ({ sendTransactionalEmail: mocks.sendTransactionalEmail }));
vi.mock("@/lib/broadcasts/progress", () => ({ recordBroadcastDelivery: mocks.recordBroadcastDelivery }));
vi.mock("@/lib/integrations/sms", () => ({
  getSmsProvider: async () => ({ name: "netgsm", sendSms: mocks.sendSms }),
}));

import { encryptSecret } from "@/lib/secrets/crypto";
import { deliverNotificationLog } from "./deliver";

const ctx = (final = false) => ({ jobId: "j1", retryCount: final ? 4 : 0, retryLimit: 4, isFinalAttempt: final });

const activatedRow = {
  id: "log-1",
  template: "service.activated",
  channel: "EMAIL",
  to: "ayse@example.com",
  status: "QUEUED",
  data: {
    recipientName: "Ayşe",
    serviceId: "s1",
    serviceLabel: "VDS Pro",
    kind: "server",
    ipAddress: "203.0.113.10",
    password: encryptSecret("S3cret-Pass"),
    passwordDelivery: "included",
  },
};

describe("deliverNotificationLog", () => {
  beforeEach(() => {
    mocks.settingFindMany.mockResolvedValue([]);
    mocks.update.mockResolvedValue({});
    mocks.findUnique.mockResolvedValue(activatedRow);
    mocks.sendTransactionalEmail.mockResolvedValue({ sent: true, messageId: "<m1@kleacore>" });
  });

  it("decrypts secrets for the actual mail, inlines the logo and marks the row SENT", async () => {
    const result = await deliverNotificationLog("log-1", ctx());

    expect(result).toEqual({ status: "SENT", logId: "log-1" });
    const mail = mocks.sendTransactionalEmail.mock.calls[0][0];
    expect(mail.to).toBe("ayse@example.com");
    expect(mail.text).toContain("S3cret-Pass");
    expect(mail.attachments[0]).toMatchObject({ cid: "kleacore-logo", contentType: "image/png" });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "log-1" },
      data: expect.objectContaining({ status: "SENT", providerMessageId: "<m1@kleacore>", error: null }),
    });
    // The update never writes the clear password back.
    expect(JSON.stringify(mocks.update.mock.calls)).not.toContain("S3cret-Pass");
  });

  it("marks the row SKIPPED when SMTP is not configured", async () => {
    mocks.sendTransactionalEmail.mockResolvedValue({ sent: false, skipped: true, reason: "SMTP_NOT_CONFIGURED" });
    await deliverNotificationLog("log-1", ctx());
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({ status: "SKIPPED", error: "SMTP_NOT_CONFIGURED" });
  });

  it("keeps the row QUEUED and rethrows so pg-boss retries; the last attempt marks FAILED", async () => {
    mocks.sendTransactionalEmail.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(deliverNotificationLog("log-1", ctx(false))).rejects.toThrow("ECONNREFUSED");
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({ status: "QUEUED", error: "ECONNREFUSED" });

    mocks.update.mockClear();
    await expect(deliverNotificationLog("log-1", ctx(true))).rejects.toThrow("ECONNREFUSED");
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({ status: "FAILED" });
  });

  it("is a no-op for rows already sent (repeated job)", async () => {
    mocks.findUnique.mockResolvedValue({ ...activatedRow, status: "SENT" });
    expect(await deliverNotificationLog("log-1", ctx())).toEqual({ skipped: "ALREADY_SENT" });
    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("sends the template's SMS text over the configured provider", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "log-2",
      template: "billing.payment-received",
      channel: "SMS",
      to: "+905551112233",
      status: "QUEUED",
      data: { invoiceId: "i1", invoiceNumber: "F-1", paidAmount: "50", paidAt: "2026-10-08T10:00:00.000Z" },
    });
    mocks.sendSms.mockResolvedValue({ sent: true, reference: "sms-1" });

    await deliverNotificationLog("log-2", ctx());
    expect(mocks.sendSms).toHaveBeenCalledWith({ to: "+905551112233", message: expect.stringContaining("F-1") });
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({ status: "SENT", providerMessageId: "sms-1" });
  });

  it("sends marketing broadcasts with List-Unsubscribe and mirrors the outcome onto the recipient", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "log-b1",
      template: "broadcast.marketing",
      channel: "EMAIL",
      to: "ayse@example.com",
      status: "QUEUED",
      data: {
        broadcastId: "b1",
        subject: "Yeni paketler",
        bodyHtml: "<p>Merhaba</p>",
        bodyText: "Merhaba",
        unsubscribeUrl: "https://kleacore.test/abonelik/iptal?t=x",
        oneClickUrl: "https://kleacore.test/api/abonelik/iptal?t=x",
      },
    });

    await deliverNotificationLog("log-b1", ctx());

    const mail = mocks.sendTransactionalEmail.mock.calls[0][0];
    expect(mail.listUnsubscribe).toBe("https://kleacore.test/api/abonelik/iptal?t=x");
    expect(mail.html).toContain("https://kleacore.test/abonelik/iptal?t=x");
    expect(mocks.recordBroadcastDelivery).toHaveBeenCalledWith("log-b1", "SENT", null);
  });

  it("does not touch broadcast recipients for other templates", async () => {
    await deliverNotificationLog("log-1", ctx());
    expect(mocks.recordBroadcastDelivery).not.toHaveBeenCalled();
  });
});
