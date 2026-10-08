import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    inboundFindUnique: fn(),
    inboundUpsert: fn(),
    inboundCount: fn(),
    inboundFindFirst: fn(),
    inboundCreate: fn(),
    inboundDelete: fn(),
    mailboxFindMany: fn(),
    settingFindMany: fn(),
    userFindFirst: fn(),
    ticketFindUnique: fn(),
    ticketCreate: fn(),
    ticketUpdate: fn(),
    messageCreate: fn(),
    attachmentCreateMany: fn(),
    sendNotification: fn(),
    loadSupportNotificationEmail: fn(),
    storagePut: fn(),
    storageDelete: fn(),
    emitEvent: fn(),
  };
});

vi.mock("@/lib/db", () => {
  const db = {
    inboundEmail: {
      findUnique: m.inboundFindUnique,
      upsert: m.inboundUpsert,
      count: m.inboundCount,
      findFirst: m.inboundFindFirst,
      create: m.inboundCreate,
      delete: m.inboundDelete,
    },
    supportMailbox: { findMany: m.mailboxFindMany },
    setting: { findMany: m.settingFindMany },
    user: { findFirst: m.userFindFirst },
    supportTicket: { findUnique: m.ticketFindUnique, create: m.ticketCreate, update: m.ticketUpdate },
    ticketMessage: { create: m.messageCreate },
    ticketAttachment: { createMany: m.attachmentCreateMany },
    $transaction: async (cb: (tx: unknown) => unknown) => cb(db),
  };
  return { db };
});
vi.mock("@/lib/notifications/send", () => ({ sendNotification: m.sendNotification }));
vi.mock("@/lib/events/emit", () => ({ emitEvent: m.emitEvent }));
vi.mock("@/lib/notifications/email", () => ({ loadSupportNotificationEmail: m.loadSupportNotificationEmail }));
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return { ...actual, getStorageDriver: () => ({ name: "local", put: m.storagePut, get: vi.fn(), delete: m.storageDelete }) };
});

import type { InboundMessage } from "./types";
import { processInboundEmail, SENDER_HOURLY_LIMIT } from "./process";

const MAILBOX = { id: "mb1", address: "destek@kleacore.com", department: "TECHNICAL" as const };
const CUSTOMER = { id: "cust1", name: "Ayşe", surname: "Yılmaz" };
const TICKET = {
  id: "tick1",
  ticketNumber: "T-123456",
  subject: "Web sitem açılmıyor",
  department: "TECHNICAL",
  customerId: "cust1",
  guestEmail: null,
  guestName: null,
  status: "ADMIN_REPLY",
};

function message(patch: Partial<InboundMessage> = {}): InboundMessage {
  return {
    messageId: "<m1@example.com>",
    from: { address: "Ayse@Example.com", name: "Ayşe" },
    subject: "Yardım lazım",
    text: "Merhaba,\nsite açılmıyor.\n\nOn Mon, 6 Oct 2026 at 10:00, Destek <destek@kleacore.com> wrote:\n> eski",
    inReplyTo: [],
    references: [],
    headers: {},
    contentType: "text/plain",
    attachments: [],
    receivedAt: new Date("2026-10-08T10:00:00Z"),
    ...patch,
  };
}

beforeEach(() => {
  m.inboundFindUnique.mockResolvedValue(null);
  m.inboundCount.mockResolvedValue(0);
  m.inboundFindFirst.mockResolvedValue(null);
  m.inboundUpsert.mockResolvedValue({});
  m.inboundCreate.mockResolvedValue({});
  m.mailboxFindMany.mockResolvedValue([{ address: "destek@kleacore.com", username: "destek@kleacore.com", department: null }]);
  m.settingFindMany.mockResolvedValue([{ value: "info@kleacore.com" }]);
  m.userFindFirst.mockResolvedValue(CUSTOMER);
  m.ticketFindUnique.mockImplementation(async ({ where }) => {
    if (where.ticketNumber === "T-123456" || where.id === "tick1") return TICKET;
    return null; // fresh ticket numbers are free
  });
  m.ticketCreate.mockImplementation(async ({ data }) => ({ id: "newtick", ...data, messages: [{ id: "msg-new" }] }));
  m.ticketUpdate.mockResolvedValue(TICKET);
  m.emitEvent.mockResolvedValue({ id: "ev1", type: "ticket.opened", queued: true });
  m.messageCreate.mockResolvedValue({ id: "msg-reply" });
  m.attachmentCreateMany.mockResolvedValue({ count: 0 });
  m.sendNotification.mockResolvedValue({ ok: true, logIds: [], deduplicated: false });
  m.loadSupportNotificationEmail.mockResolvedValue("destek@kleacore.com");
  m.storagePut.mockResolvedValue(undefined);
});

describe("processInboundEmail", () => {
  it("opens a ticket for a verified customer with the quoted part stripped and acknowledges it", async () => {
    const outcome = await processInboundEmail(message(), MAILBOX);

    expect(outcome).toEqual({ status: "CREATED", ticketId: "newtick", guest: false });
    expect(m.userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: "ayse@example.com", mode: "insensitive" }, role: "CUSTOMER", emailVerifiedAt: { not: null } },
      })
    );
    const data = m.ticketCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({ customerId: "cust1", source: "EMAIL", department: "TECHNICAL", subject: "Yardım lazım", guestEmail: null });
    expect(data.messages.create).toMatchObject({ senderId: "cust1", senderName: "Ayşe Yılmaz", message: "Merhaba,\nsite açılmıyor.", source: "EMAIL" });
    expect(m.inboundCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ messageId: "<m1@example.com>", status: "PROCESSED", ticketId: "newtick", reason: "NEW_TICKET" }),
    });
    // Staff alert + activity log go through the outbox (admin-alert subscriber).
    expect(m.emitEvent).toHaveBeenCalledWith(
      expect.anything(),
      "ticket.opened",
      expect.objectContaining({ ticketId: "newtick", source: "email", customerId: "cust1", subject: "Yardım lazım" })
    );
    expect(m.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "cust1",
        template: "support.ticket-received",
        dedupeKey: "ticket.received:newtick",
        data: expect.objectContaining({ replyTo: "destek@kleacore.com", hasAccount: true }),
      })
    );
  });

  it("opens a flagged guest ticket for an unknown sender", async () => {
    m.userFindFirst.mockResolvedValue(null);
    const outcome = await processInboundEmail(message({ from: { address: "yeni@firma.com", name: "Yeni Kişi" } }), MAILBOX);

    expect(outcome).toEqual({ status: "CREATED", ticketId: "newtick", guest: true });
    expect(m.ticketCreate.mock.calls[0][0].data).toMatchObject({ customerId: null, guestEmail: "yeni@firma.com", guestName: "Yeni Kişi" });
    expect(m.ticketCreate.mock.calls[0][0].data.messages.create.senderId).toBe("email:yeni@firma.com");
    expect(m.sendNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: null, to: "yeni@firma.com" }));
  });

  it("appends to the ticket named in the subject and moves it to CUSTOMER_REPLY", async () => {
    const outcome = await processInboundEmail(message({ subject: "Re: [#T-123456] Destek talebiniz yanıtlandı: Web" }), MAILBOX);

    expect(outcome).toEqual({ status: "REPLIED", ticketId: "tick1" });
    expect(m.ticketCreate).not.toHaveBeenCalled();
    expect(m.messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ticketId: "tick1", message: "Merhaba,\nsite açılmıyor.", source: "EMAIL" }) })
    );
    expect(m.ticketUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tick1" },
        data: { status: "CUSTOMER_REPLY", closedAt: null, waitingSince: null, autoCloseWarnedAt: null },
      })
    );
    // The staff copy is sent by the notifications subscriber of ticket.replied.
    expect(m.emitEvent).toHaveBeenCalledWith(
      expect.anything(),
      "ticket.replied",
      expect.objectContaining({ ticketId: "tick1", authorRole: "CUSTOMER", senderName: "Ayşe Yılmaz" })
    );
  });

  it("appends by In-Reply-To / References when the subject lost the tag", async () => {
    const byOurId = await processInboundEmail(
      message({ subject: "Re: Destek", inReplyTo: ["<ticket.T-123456.ab12@kleacore.com>"] }),
      MAILBOX
    );
    expect(byOurId).toEqual({ status: "REPLIED", ticketId: "tick1" });

    m.inboundFindFirst.mockResolvedValue({ ticket: TICKET });
    const byEarlierMail = await processInboundEmail(
      message({ messageId: "<m2@example.com>", subject: "Re: Yardım lazım", references: ["<m1@example.com>"] }),
      MAILBOX
    );
    expect(byEarlierMail).toEqual({ status: "REPLIED", ticketId: "tick1" });
    expect(m.inboundFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { messageId: { in: ["<m1@example.com>"] }, ticketId: { not: null } } })
    );
  });

  it("does not let someone else post into a ticket by quoting its number", async () => {
    m.userFindFirst.mockResolvedValue({ id: "other", name: "Başka", surname: "Biri" });
    const outcome = await processInboundEmail(message({ subject: "[#T-123456] araya giriyorum" }), MAILBOX);

    expect(outcome.status).toBe("CREATED");
    expect(m.messageCreate).not.toHaveBeenCalled();
    expect(m.ticketCreate.mock.calls[0][0].data).toMatchObject({ customerId: "other", subject: "araya giriyorum" });
    expect(m.inboundCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ reason: "NEW_TICKET_THREAD_NOT_OWNED" }) });
  });

  it("is idempotent per Message-ID", async () => {
    m.inboundFindUnique.mockResolvedValue({ id: "in1", status: "PROCESSED", attempts: 1 });
    expect(await processInboundEmail(message(), MAILBOX)).toEqual({ status: "DUPLICATE" });
    m.inboundFindUnique.mockResolvedValue({ id: "in1", status: "IGNORED", attempts: 1 });
    expect(await processInboundEmail(message(), MAILBOX)).toEqual({ status: "DUPLICATE" });
    expect(m.ticketCreate).not.toHaveBeenCalled();
    expect(m.messageCreate).not.toHaveBeenCalled();
  });

  it("retries a FAILED message and replaces its row", async () => {
    m.inboundFindUnique.mockResolvedValue({ id: "in-failed", status: "FAILED", attempts: 1 });
    expect((await processInboundEmail(message(), MAILBOX)).status).toBe("CREATED");
    expect(m.inboundDelete).toHaveBeenCalledWith({ where: { id: "in-failed" } });
  });

  it.each([
    [{ headers: { "auto-submitted": "auto-replied" } }, "AUTO_SUBMITTED"],
    [{ headers: { "x-autoreply": "yes" } }, "X_AUTOREPLY"],
    [{ from: { address: "mailer-daemon@mx.example.com", name: null } }, "SYSTEM_SENDER"],
    [{ from: { address: "destek@kleacore.com", name: "Biz" } }, "OWN_ADDRESS"],
    [{ from: { address: "INFO@kleacore.com", name: "Biz" } }, "OWN_ADDRESS"],
  ])("ignores loops / auto-replies: %j", async (patch, reason) => {
    const outcome = await processInboundEmail(message(patch as Partial<InboundMessage>), MAILBOX);
    expect(outcome).toEqual({ status: "IGNORED", reason });
    expect(m.ticketCreate).not.toHaveBeenCalled();
    expect(m.sendNotification).not.toHaveBeenCalled();
    expect(m.inboundUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ status: "IGNORED", reason }) })
    );
  });

  it("brakes a sender that floods the mailbox", async () => {
    m.inboundCount.mockResolvedValue(SENDER_HOURLY_LIMIT);
    expect(await processInboundEmail(message(), MAILBOX)).toEqual({ status: "IGNORED", reason: "SENDER_RATE_LIMIT" });
  });

  it("stores valid attachments and notes rejected ones in the message", async () => {
    const pdf = Buffer.from("%PDF-1.4\n");
    const exe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(16)]);
    await processInboundEmail(
      message({
        attachments: [
          { fileName: "fatura.pdf", content: pdf, related: false },
          { fileName: "virus.exe", content: exe, related: false },
          { fileName: "logo.png", content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), related: true },
        ],
      }),
      MAILBOX
    );

    expect(m.storagePut).toHaveBeenCalledTimes(1);
    expect(m.storagePut.mock.calls[0][0]).toMatch(/^tickets\/\d{4}\/\d{2}\/[0-9a-f-]{36}$/);
    expect(m.attachmentCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ ticketId: "newtick", messageId: "msg-new", fileName: "fatura.pdf", mimeType: "application/pdf" })],
    });
    expect(m.ticketCreate.mock.calls[0][0].data.messages.create.message).toContain(
      "[Kabul edilmeyen ekler: virus.exe: çalıştırılabilir dosyalar kabul edilmiyor]"
    );
  });

  it("removes stored files again when the database write fails, and records the failure", async () => {
    m.ticketCreate.mockRejectedValue(new Error("db down"));
    const outcome = await processInboundEmail(
      message({ attachments: [{ fileName: "fatura.pdf", content: Buffer.from("%PDF-1.4\n"), related: false }] }),
      MAILBOX
    );
    expect(outcome).toEqual({ status: "FAILED", error: "db down", final: false });
    expect(m.storageDelete).toHaveBeenCalledWith(m.storagePut.mock.calls[0][0]);
    expect(m.inboundUpsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ status: "FAILED" }) }));
  });
});
