/**
 * End-to-end: real IMAP/SMTP server (GreenMail in Docker) + real Postgres.
 * Skipped unless RUN_IMAP_TESTS=1. Uses DATABASE_URL from .env (a local DB
 * copy, never production) and a temp dir for attachment storage:
 *
 *   docker run -d --rm --name kc-greenmail -p 3025:3025 -p 3143:3143 \
 *     -e GREENMAIL_OPTS='-Dgreenmail.setup.test.smtp -Dgreenmail.setup.test.imap -Dgreenmail.hostname=0.0.0.0 -Dgreenmail.users=destek:destek123@kleacore.test -Dgreenmail.users.login=email' \
 *     greenmail/standalone:2.1.3
 *   RUN_IMAP_TESTS=1 pnpm vitest run src/lib/support/inbound/imap.integration.test.ts
 */
import "dotenv/config";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => ({ notifications: [] as Array<Record<string, unknown>> }));
// Outgoing mail is not under test here (and would need the pg-boss worker).
vi.mock("@/lib/notifications/send", () => ({
  sendNotification: async (input: Record<string, unknown>) => {
    sent.notifications.push(input);
    return { ok: true, logIds: [], deduplicated: false };
  },
}));

import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import type { SupportMailbox } from "@prisma/client";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/secrets/crypto";
import { getStorageDriver, resetStorageDrivers } from "@/lib/storage";
import { REPLY_MARKER } from "@/lib/support/thread";
import { runTicketAutoClose } from "@/lib/support/auto-close";
import { pollMailbox } from "./poller";

const enabled = process.env.RUN_IMAP_TESTS === "1";
const HOST = process.env.GREENMAIL_HOST ?? "127.0.0.1";
const MAILBOX_ADDRESS = "destek@kleacore.test";
const run = randomUUID().slice(0, 8);
const customerEmail = `musteri-${run}@example.test`;
const guestEmail = `yabanci-${run}@example.test`;

const smtp = nodemailer.createTransport({ host: HOST, port: 3025, secure: false, tls: { rejectUnauthorized: false } });
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n");
const EXE = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(128)]);

async function imap() {
  const client = new ImapFlow({
    host: HOST,
    port: 3143,
    secure: false,
    doSTARTTLS: false,
    auth: { user: MAILBOX_ADDRESS, pass: "destek123" },
    logger: false,
  });
  await client.connect();
  return client;
}

async function clearInbox() {
  const client = await imap();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const all = await client.search({ all: true }, { uid: true });
    if (all && all.length) await client.messageDelete(all.map(String).join(","), { uid: true });
  } finally {
    lock.release();
    await client.logout();
  }
}

async function unseenCount() {
  const client = await imap();
  const lock = await client.getMailboxLock("INBOX");
  try {
    return ((await client.search({ seen: false }, { uid: true })) || []).length;
  } finally {
    lock.release();
    await client.logout();
  }
}

describe.runIf(enabled)("IMAP → ticket (GreenMail + Postgres)", () => {
  let storageDir: string;
  let mailbox: SupportMailbox;
  let customerId: string;
  let firstTicketId: string;
  let firstTicketNumber: string;

  beforeAll(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), "kc-imap-e2e-"));
    process.env.STORAGE_LOCAL_DIR = storageDir;
    process.env.STORAGE_DRIVER = "local";
    resetStorageDrivers();
    await clearInbox();

    const customer = await db.user.create({
      data: {
        email: customerEmail,
        password: "x",
        name: "Ayşe",
        surname: "Deneme",
        role: "CUSTOMER",
        emailVerifiedAt: new Date(),
      },
    });
    customerId = customer.id;
    mailbox = await db.supportMailbox.create({
      data: {
        name: `e2e-${run}`,
        address: MAILBOX_ADDRESS,
        host: HOST,
        port: 3143,
        secure: false,
        username: MAILBOX_ADDRESS,
        password: encryptSecret("destek123"),
        department: "TECHNICAL",
        processedFolder: "Islenen",
      },
    });
  });

  afterAll(async () => {
    const tickets = await db.supportTicket.findMany({
      where: { OR: [{ customerId }, { guestEmail }] },
      select: { id: true },
    });
    await db.inboundEmail.deleteMany({ where: { mailboxId: mailbox?.id } });
    await db.supportTicket.deleteMany({ where: { id: { in: tickets.map((t) => t.id) } } });
    if (mailbox) await db.supportMailbox.delete({ where: { id: mailbox.id } });
    if (customerId) await db.user.delete({ where: { id: customerId } });
    await rm(storageDir, { recursive: true, force: true });
    smtp.close();
  });

  it("turns new mail into tickets (customer + guest), ignores auto-replies, stores attachments", async () => {
    await smtp.sendMail({
      from: `Ayşe Deneme <${customerEmail}>`,
      to: MAILBOX_ADDRESS,
      subject: "Web sitem açılmıyor",
      messageId: `<new-${run}@example.test>`,
      text: "Merhaba,\nsitem açılmıyor.\n\n-- \nAyşe Deneme\nACME",
      attachments: [
        { filename: "ekran.pdf", content: PDF, contentType: "application/pdf" },
        { filename: "kurulum.exe", content: EXE, contentType: "application/octet-stream" },
      ],
    });
    await smtp.sendMail({
      from: `Yabancı Kişi <${guestEmail}>`,
      to: MAILBOX_ADDRESS,
      subject: "Fiyat sorusu",
      html: "<p>Merhaba, <b>VDS</b> fiyatlarınız nedir?</p><script>alert(1)</script>",
    });
    await smtp.sendMail({
      from: `Ayşe Deneme <${customerEmail}>`,
      to: MAILBOX_ADDRESS,
      subject: "Otomatik yanıt: Ofis dışındayım",
      headers: { "Auto-Submitted": "auto-replied" },
      text: "Şu an ofis dışındayım.",
    });

    const summary = await pollMailbox(mailbox);
    expect(summary).toMatchObject({ fetched: 3, created: 2, ignored: 1, failed: 0 });
    expect(await unseenCount()).toBe(0); // moved to the processed folder

    const ticket = await db.supportTicket.findFirstOrThrow({
      where: { customerId },
      include: { messages: { include: { files: true } } },
    });
    firstTicketId = ticket.id;
    firstTicketNumber = ticket.ticketNumber;
    expect(ticket).toMatchObject({ source: "EMAIL", department: "TECHNICAL", subject: "Web sitem açılmıyor", status: "OPEN" });
    expect(ticket.messages).toHaveLength(1);
    expect(ticket.messages[0].message).toContain("Merhaba,\nsitem açılmıyor.");
    expect(ticket.messages[0].message).not.toContain("ACME");
    expect(ticket.messages[0].message).toContain("kurulum.exe: çalıştırılabilir dosyalar kabul edilmiyor");
    expect(ticket.messages[0].files).toHaveLength(1);
    const file = ticket.messages[0].files[0];
    expect(file).toMatchObject({ fileName: "ekran.pdf", mimeType: "application/pdf", storageDriver: "local" });
    expect(file.storageKey).toMatch(/^tickets\/\d{4}\/\d{2}\/[0-9a-f-]{36}$/);
    expect((await getStorageDriver("local").get(file.storageKey))?.equals(PDF)).toBe(true);

    const guest = await db.supportTicket.findFirstOrThrow({ where: { guestEmail }, include: { messages: true } });
    expect(guest).toMatchObject({ customerId: null, guestName: "Yabancı Kişi", source: "EMAIL" });
    expect(guest.messages[0].message).toContain("VDS fiyatlarınız nedir?");
    expect(guest.messages[0].message).not.toContain("alert");

    const ignored = await db.inboundEmail.findFirstOrThrow({ where: { mailboxId: mailbox.id, status: "IGNORED" } });
    expect(ignored.reason).toBe("AUTO_SUBMITTED");
    expect(sent.notifications.filter((n) => n.template === "support.ticket-received")).toHaveLength(2);
  });

  it("appends replies matched by subject tag and by In-Reply-To, stripping quotes (TR + EN)", async () => {
    await db.supportTicket.update({ where: { id: firstTicketId }, data: { status: "ADMIN_REPLY", waitingSince: new Date() } });

    await smtp.sendMail({
      from: customerEmail,
      to: MAILBOX_ADDRESS,
      subject: `YNT: [#${firstTicketNumber}] Destek talebiniz yanıtlandı: Web sitem açılmıyor`,
      text: `Hâlâ açılmıyor.\n\n6 Eki 2026 Pzt, 10:00 tarihinde KLEACORE <${MAILBOX_ADDRESS}> şunu yazdı:\n> ${REPLY_MARKER}\n> Merhaba`,
    });
    await smtp.sendMail({
      from: customerEmail,
      to: MAILBOX_ADDRESS,
      subject: "Re: bir şey",
      inReplyTo: `<ticket.${firstTicketNumber}.abcdef0123456789@kleacore.test>`,
      references: [`<ticket.${firstTicketNumber}.abcdef0123456789@kleacore.test>`],
      text: "Bir de şu var.\n\nOn Mon, Oct 6, 2026 at 10:00 AM KLEACORE <destek@kleacore.test> wrote:\n> old",
    });
    // Someone else quoting the number must not get into the thread.
    await smtp.sendMail({
      from: guestEmail,
      to: MAILBOX_ADDRESS,
      subject: `Re: [#${firstTicketNumber}] araya giriyorum`,
      text: "Ben de yazayım.",
    });

    const summary = await pollMailbox(mailbox);
    expect(summary).toMatchObject({ fetched: 3, replied: 2, created: 1, failed: 0 });

    const ticket = await db.supportTicket.findUniqueOrThrow({
      where: { id: firstTicketId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    expect(ticket.status).toBe("CUSTOMER_REPLY");
    expect(ticket.waitingSince).toBeNull();
    expect(ticket.messages.map((m) => m.message.trim())).toEqual([
      expect.stringContaining("sitem açılmıyor"),
      "Hâlâ açılmıyor.",
      "Bir de şu var.",
    ]);
    expect(await db.supportTicket.count({ where: { guestEmail } })).toBe(2);
  });

  it("is idempotent: the same Message-ID delivered again is not processed twice", async () => {
    const client = await imap();
    try {
      const raw = [
        `From: ${customerEmail}`,
        `To: ${MAILBOX_ADDRESS}`,
        "Subject: Web sitem açılmıyor",
        `Message-ID: <new-${run}@example.test>`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        "Aynı ileti tekrar.",
      ].join("\r\n");
      await client.append("INBOX", raw);
    } finally {
      await client.logout();
    }

    const before = await db.ticketMessage.count({ where: { ticketId: firstTicketId } });
    const summary = await pollMailbox(mailbox);
    expect(summary).toMatchObject({ fetched: 1, duplicates: 1, created: 0, replied: 0 });
    expect(await db.ticketMessage.count({ where: { ticketId: firstTicketId } })).toBe(before);
    expect(await unseenCount()).toBe(0);

    // Nothing unseen left: a second poll does nothing.
    expect(await pollMailbox(mailbox)).toMatchObject({ fetched: 0 });
  });

  it("auto-close (real DB): warns once, closes once", async () => {
    const DAY = 86_400_000;
    const now = new Date();
    await db.supportTicket.update({
      where: { id: firstTicketId },
      data: { status: "WAITING", waitingSince: new Date(now.getTime() - 4.5 * DAY), autoCloseWarnedAt: null },
    });
    const warn1 = await runTicketAutoClose(now, 5);
    const warn2 = await runTicketAutoClose(now, 5);
    expect(warn1.warned).toBeGreaterThanOrEqual(1);
    expect(warn2.warned).toBe(0);
    expect(sent.notifications.filter((n) => n.template === "support.ticket-auto-close-warning" && (n.data as { ticketId: string }).ticketId === firstTicketId)).toHaveLength(1);

    const later = new Date(now.getTime() + 1.1 * DAY);
    const close1 = await runTicketAutoClose(later, 5);
    const close2 = await runTicketAutoClose(later, 5);
    expect(close1.ids).toContain(firstTicketId);
    expect(close2.ids ?? []).not.toContain(firstTicketId);
    const ticket = await db.supportTicket.findUniqueOrThrow({ where: { id: firstTicketId }, include: { messages: true } });
    expect(ticket.status).toBe("CLOSED");
    expect(ticket.messages.filter((m) => m.senderId === "system")).toHaveLength(1);
  });
});
