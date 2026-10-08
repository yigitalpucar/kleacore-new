import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  settingFindMany: vi.fn(),
  createManyAndReturn: vi.fn(),
  logUpdate: vi.fn(),
  emailMessageCreate: vi.fn(),
  getSettingValue: vi.fn(),
  getSmsConfig: vi.fn(),
  isSmsConfigured: vi.fn(),
  queueNotificationDelivery: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    setting: { findMany: mocks.settingFindMany },
    notificationLog: { createManyAndReturn: mocks.createManyAndReturn, update: mocks.logUpdate },
    emailMessage: { create: mocks.emailMessageCreate },
  },
}));
vi.mock("@/lib/integrations/settings", () => ({
  getSettingValue: mocks.getSettingValue,
  isEnabled: (value: string | undefined | null) => ["1", "true", "yes", "on"].includes((value ?? "").toLowerCase()),
}));
vi.mock("@/lib/integrations/sms", () => ({ getSmsConfig: mocks.getSmsConfig, isSmsConfigured: mocks.isSmsConfigured }));
vi.mock("./queue", () => ({ queueNotificationDelivery: mocks.queueNotificationDelivery }));

import { decryptSecret, isEncryptedValue } from "@/lib/secrets/crypto";
import { sendNotification } from "./send";

type CreatedRow = { channel: string; data: Record<string, unknown>; subject: string; to: string; dedupeKey: string | null; redacted: boolean };

function createdRows(): CreatedRow[] {
  return mocks.createManyAndReturn.mock.calls[0][0].data;
}

describe("sendNotification", () => {
  beforeEach(() => {
    mocks.userFindUnique.mockResolvedValue({ name: "Ayşe", surname: "Yılmaz", email: "ayse@example.com", phone: "+905551112233" });
    mocks.settingFindMany.mockResolvedValue([]);
    mocks.getSettingValue.mockResolvedValue("false");
    mocks.getSmsConfig.mockResolvedValue({});
    mocks.isSmsConfigured.mockReturnValue(true);
    mocks.createManyAndReturn.mockImplementation(async ({ data }: { data: CreatedRow[] }) =>
      data.map((row, index) => ({ id: `log-${index + 1}`, channel: row.channel }))
    );
    mocks.emailMessageCreate.mockResolvedValue({ id: "msg-1" });
    mocks.logUpdate.mockResolvedValue({});
    mocks.queueNotificationDelivery.mockResolvedValue({ queued: true });
  });

  it("writes a QUEUED e-mail log row for the account address and enqueues it", async () => {
    const result = await sendNotification({
      userId: "u1",
      template: "billing.invoice-created",
      data: { invoiceId: "i1", invoiceNumber: "F-1", totalAmount: 100, dueDate: new Date("2026-10-15T00:00:00Z") },
      dedupeKey: "invoice.created:i1",
    });

    expect(result).toEqual({ ok: true, logIds: ["log-1"], deduplicated: false });
    const [row] = createdRows();
    expect(row).toMatchObject({
      channel: "EMAIL",
      to: "ayse@example.com",
      subject: "Yeni faturanız: F-1",
      dedupeKey: "invoice.created:i1",
      redacted: false,
    });
    expect(row.data).toMatchObject({ recipientName: "Ayşe Yılmaz", invoiceNumber: "F-1", dueDate: "2026-10-15T00:00:00.000Z" });
    expect(mocks.createManyAndReturn.mock.calls[0][0].skipDuplicates).toBe(true);
    expect(mocks.queueNotificationDelivery).toHaveBeenCalledWith("log-1", undefined);
    // Customer inbox copy.
    expect(mocks.emailMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerId: "u1", category: "BILLING" }) })
    );
  });

  it("reports a dedupe hit without enqueuing anything", async () => {
    mocks.createManyAndReturn.mockResolvedValue([]);
    const result = await sendNotification({
      userId: "u1",
      template: "billing.invoice-created",
      data: { invoiceId: "i1", invoiceNumber: "F-1", totalAmount: 100, dueDate: new Date() },
      dedupeKey: "invoice.created:i1",
    });
    expect(result).toEqual({ ok: true, logIds: [], deduplicated: true });
    expect(mocks.queueNotificationDelivery).not.toHaveBeenCalled();
    expect(mocks.emailMessageCreate).not.toHaveBeenCalled();
  });

  it("encrypts sensitive fields and redacts the inbox copy", async () => {
    await sendNotification({
      userId: "u1",
      template: "service.activated",
      data: { serviceId: "s1", serviceLabel: "VDS", kind: "server", ipAddress: "203.0.113.10", password: "S3cret-Pass", passwordDelivery: "included" },
    });

    const [row] = createdRows();
    expect(row.redacted).toBe(true);
    const stored = row.data.password as string;
    expect(isEncryptedValue(stored)).toBe(true);
    expect(decryptSecret(stored)).toBe("S3cret-Pass");
    expect(JSON.stringify(row)).not.toContain("S3cret-Pass");

    const inbox = mocks.emailMessageCreate.mock.calls[0][0].data;
    expect(inbox.content).not.toContain("S3cret-Pass");
    expect(inbox.content).toContain("(gizli)");
  });

  it("adds an SMS row only when SMS notifications are on and the template has an SMS text", async () => {
    mocks.getSettingValue.mockResolvedValue("true");

    await sendNotification({
      userId: "u1",
      template: "billing.payment-received",
      data: { invoiceId: "i1", invoiceNumber: "F-1", paidAmount: "50", paidAt: new Date() },
    });
    expect(createdRows().map((row) => [row.channel, row.to])).toEqual([
      ["EMAIL", "ayse@example.com"],
      ["SMS", "+905551112233"],
    ]);

    mocks.createManyAndReturn.mockClear();
    await sendNotification({
      userId: "u1",
      template: "billing.invoice-created",
      data: { invoiceId: "i1", invoiceNumber: "F-1", totalAmount: 1, dueDate: new Date() },
    });
    expect(createdRows().map((row) => row.channel)).toEqual(["EMAIL"]);
  });

  it("skips SMS when it is disabled", async () => {
    mocks.getSettingValue.mockResolvedValue("false");
    await sendNotification({
      userId: "u1",
      template: "billing.payment-received",
      data: { invoiceId: "i1", invoiceNumber: "F-1", paidAmount: "50", paidAt: new Date() },
    });
    expect(createdRows().map((row) => row.channel)).toEqual(["EMAIL"]);
    expect(mocks.isSmsConfigured).not.toHaveBeenCalled();
  });

  it("sends staff notifications to an explicit address without an inbox copy", async () => {
    await sendNotification({
      template: "admin.ticket-customer-reply",
      data: { ticketId: "t1", ticketNumber: "T-1", ticketSubject: "Konu", senderName: "Ayşe", messagePreview: "Merhaba" },
      to: "destek@kleacore.com",
      channel: "EMAIL",
    });
    expect(createdRows()[0]).toMatchObject({ to: "destek@kleacore.com", channel: "EMAIL" });
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.emailMessageCreate).not.toHaveBeenCalled();
  });

  it("never throws: invalid data is reported, nothing is written", async () => {
    const result = await sendNotification({
      userId: "u1",
      template: "auth.verify-email",
      data: { verifyUrl: "kein-url" },
    });
    expect(result.ok).toBe(false);
    expect(mocks.createManyAndReturn).not.toHaveBeenCalled();
  });

  it("passes the caller's transaction to the log insert and the queue", async () => {
    const tx = {
      user: { findUnique: mocks.userFindUnique },
      notificationLog: { createManyAndReturn: mocks.createManyAndReturn, update: mocks.logUpdate },
      emailMessage: { create: mocks.emailMessageCreate },
    };
    await sendNotification({
      userId: "u1",
      template: "service.unsuspended",
      data: { serviceId: "s1", serviceLabel: "Hosting" },
      tx: tx as never,
    });
    expect(mocks.queueNotificationDelivery).toHaveBeenCalledWith("log-1", tx);
  });
});
