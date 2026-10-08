import type { SupportMailbox } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { sendNotification } from "@/lib/notifications/send";
import { MAX_ATTACHMENTS, validateAttachment, type ValidAttachment } from "@/lib/support/attachments";
import { ticketNumberFromMessageIds, ticketNumberFromSubject } from "@/lib/support/thread";
import {
  appendTicketMessage,
  createTicketRecord,
  supportReplyAddress,
  withStoredAttachments,
} from "@/lib/support/tickets";
import { autoReplyReason, cleanSubject, stripQuotedReply } from "./parse";
import type { InboundMessage } from "./types";

const log = createLogger("support.inbound");

/** At most this many mails per sender per hour become tickets/replies (loop brake). */
export const SENDER_HOURLY_LIMIT = 20;
/** A message that fails this many times is given up on (left FAILED, marked processed in the mailbox). */
export const MAX_PROCESS_ATTEMPTS = 3;

export type InboundOutcome =
  | { status: "CREATED"; ticketId: string; guest: boolean }
  | { status: "REPLIED"; ticketId: string }
  | { status: "IGNORED"; reason: string }
  | { status: "DUPLICATE" }
  | { status: "FAILED"; error: string; final: boolean };

type MailboxRef = Pick<SupportMailbox, "id" | "address" | "department">;

function lower(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

async function ownAddresses(): Promise<Set<string>> {
  const [mailboxes, settings] = await Promise.all([
    db.supportMailbox.findMany({ select: { address: true, username: true } }),
    db.setting.findMany({ where: { key: { in: ["company_email", "support_email"] } }, select: { value: true } }),
  ]);
  const set = new Set<string>();
  for (const m of mailboxes) {
    set.add(lower(m.address));
    if (m.username.includes("@")) set.add(lower(m.username));
  }
  for (const s of settings) if (s.value) set.add(lower(s.value));
  for (const env of [process.env.SMTP_FROM, process.env.EMAIL_FROM]) {
    const address = env?.match(/[^\s<>]+@[^\s<>]+/)?.[0];
    if (address) set.add(lower(address));
  }
  set.delete("");
  return set;
}

async function recordIgnored(message: InboundMessage, mailbox: MailboxRef, reason: string): Promise<InboundOutcome> {
  await db.inboundEmail.upsert({
    where: { messageId: message.messageId },
    create: {
      messageId: message.messageId,
      mailboxId: mailbox.id,
      fromAddress: lower(message.from.address),
      fromName: message.from.name,
      subject: message.subject.slice(0, 500),
      status: "IGNORED",
      reason,
      receivedAt: message.receivedAt,
    },
    update: { status: "IGNORED", reason },
  });
  return { status: "IGNORED", reason };
}

/** Our own Message-IDs or an earlier inbound mail of the thread → ticket. */
async function findThreadTicket(message: InboundMessage) {
  const number =
    ticketNumberFromSubject(message.subject) ?? ticketNumberFromMessageIds([...message.inReplyTo, ...message.references]);
  if (number) {
    const ticket = await db.supportTicket.findUnique({ where: { ticketNumber: number } });
    if (ticket) return ticket;
  }
  const ids = [...message.inReplyTo, ...message.references].filter(Boolean);
  if (ids.length) {
    const previous = await db.inboundEmail.findFirst({
      where: { messageId: { in: ids }, ticketId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { ticket: true },
    });
    if (previous?.ticket) return previous.ticket;
  }
  return null;
}

function prepareAttachments(message: InboundMessage) {
  const accepted: ValidAttachment[] = [];
  const rejected: string[] = [];
  for (const attachment of message.attachments) {
    if (attachment.related) continue;
    if (accepted.length >= MAX_ATTACHMENTS) {
      rejected.push(`${attachment.fileName}: en fazla ${MAX_ATTACHMENTS} dosya`);
      continue;
    }
    const result = validateAttachment({ name: attachment.fileName, data: attachment.content });
    if (result.ok) accepted.push(result);
    else rejected.push(result.error);
  }
  return { accepted, rejected };
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Turns one received e-mail into a ticket or a reply. Idempotent per
 * Message-ID: the InboundEmail row is written in the same transaction as the
 * ticket change, so a re-run after a crash (mail still unread) is a no-op.
 */
export async function processInboundEmail(message: InboundMessage, mailbox: MailboxRef): Promise<InboundOutcome> {
  const existing = await db.inboundEmail.findUnique({ where: { messageId: message.messageId } });
  if (existing && existing.status !== "FAILED") return { status: "DUPLICATE" };

  const fromAddress = lower(message.from.address);
  if (!fromAddress || !fromAddress.includes("@")) return recordIgnored(message, mailbox, "NO_SENDER");

  const auto = autoReplyReason(message);
  if (auto) return recordIgnored(message, mailbox, auto);

  if ((await ownAddresses()).has(fromAddress)) return recordIgnored(message, mailbox, "OWN_ADDRESS");

  const recent = await db.inboundEmail.count({
    where: { fromAddress, status: "PROCESSED", createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= SENDER_HOURLY_LIMIT) return recordIgnored(message, mailbox, "SENDER_RATE_LIMIT");

  try {
    const outcome = await writeTicketChange(message, mailbox, fromAddress, existing?.id ?? null);
    return outcome;
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "DUPLICATE" };
    const text = error instanceof Error ? error.message : String(error);
    const attempts = (existing?.attempts ?? 0) + 1;
    await db.inboundEmail
      .upsert({
        where: { messageId: message.messageId },
        create: {
          messageId: message.messageId,
          mailboxId: mailbox.id,
          fromAddress,
          fromName: message.from.name,
          subject: message.subject.slice(0, 500),
          status: "FAILED",
          reason: text.slice(0, 1000),
          receivedAt: message.receivedAt,
        },
        update: { status: "FAILED", reason: text.slice(0, 1000), attempts },
      })
      .catch(() => {});
    log.error("inbound mail failed", { messageId: message.messageId, attempts, error });
    return { status: "FAILED", error: text, final: attempts >= MAX_PROCESS_ATTEMPTS };
  }
}

async function writeTicketChange(
  message: InboundMessage,
  mailbox: MailboxRef,
  fromAddress: string,
  failedRowId: string | null
): Promise<InboundOutcome> {
  const customer = await db.user.findFirst({
    where: {
      email: { equals: fromAddress, mode: "insensitive" },
      role: "CUSTOMER",
      emailVerifiedAt: { not: null },
    },
    select: { id: true, name: true, surname: true },
  });

  const senderName =
    (customer ? `${customer.name} ${customer.surname}`.trim() : "") ||
    message.from.name?.trim() ||
    fromAddress.split("@")[0];
  const author = { senderId: customer?.id ?? `email:${fromAddress}`, senderName, senderRole: "CUSTOMER" as const };

  const { accepted, rejected } = prepareAttachments(message);
  let body = stripQuotedReply(message.text).trim();
  if (!body) body = accepted.length ? "(Mesaj metni yok, ekleri inceleyin.)" : "(Boş mesaj)";
  if (rejected.length) body += `\n\n[Kabul edilmeyen ekler: ${rejected.join("; ")}]`;

  // A thread match only counts when the sender owns the ticket; anyone else
  // quoting a ticket number gets a separate (flagged) ticket instead.
  const threadTicket = await findThreadTicket(message);
  const owned =
    threadTicket &&
    (threadTicket.customerId
      ? customer?.id === threadTicket.customerId
      : lower(threadTicket.guestEmail) === fromAddress);

  const inboundData = {
    messageId: message.messageId,
    mailboxId: mailbox.id,
    fromAddress,
    fromName: message.from.name,
    subject: message.subject.slice(0, 500),
    status: "PROCESSED" as const,
    receivedAt: message.receivedAt,
  };

  if (threadTicket && owned) {
    const { messageId } = await withStoredAttachments(accepted, async (tx, stored) => {
      const result = await appendTicketMessage(
        tx,
        { ticketId: threadTicket.id, author, message: body, source: "EMAIL", nextStatus: "CUSTOMER_REPLY" },
        stored
      );
      if (failedRowId) await tx.inboundEmail.delete({ where: { id: failedRowId } });
      await tx.inboundEmail.create({
        data: { ...inboundData, ticketId: threadTicket.id, ticketMessageId: result.messageId, reason: "REPLY" },
      });
      return result;
    });
    log.info("inbound mail appended", { ticketId: threadTicket.id, messageId });
    return { status: "REPLIED", ticketId: threadTicket.id };
  }

  const subject = cleanSubject(message.subject) || "(Konu yok)";
  const { ticket, messageId } = await withStoredAttachments(accepted, async (tx, stored) => {
    const result = await createTicketRecord(
      tx,
      {
        customerId: customer?.id ?? null,
        guestEmail: customer ? null : fromAddress,
        guestName: customer ? null : message.from.name?.trim() || null,
        subject,
        department: mailbox.department ?? "GENERAL",
        priority: "MEDIUM",
        source: "EMAIL",
        author,
        message: body,
      },
      stored
    );
    if (failedRowId) await tx.inboundEmail.delete({ where: { id: failedRowId } });
    await tx.inboundEmail.create({
      data: {
        ...inboundData,
        ticketId: result.ticket.id,
        ticketMessageId: result.messageId,
        reason: threadTicket ? "NEW_TICKET_THREAD_NOT_OWNED" : customer ? "NEW_TICKET" : "NEW_TICKET_GUEST",
      },
    });
    return result;
  });
  log.info("inbound mail opened ticket", { ticketId: ticket.id, messageId, guest: !customer });

  const replyTo = (await supportReplyAddress(mailbox.department).catch(() => undefined)) ?? mailbox.address;
  await sendNotification({
    userId: customer?.id ?? null,
    to: customer ? undefined : fromAddress,
    template: "support.ticket-received",
    channel: "EMAIL",
    dedupeKey: `ticket.received:${ticket.id}`,
    data: {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      ticketSubject: ticket.subject,
      hasAccount: !!customer,
      ...(customer ? {} : { recipientName: message.from.name?.trim() || undefined }),
      ...(replyTo && replyTo.includes("@") ? { replyTo } : {}),
    },
  });
  return { status: "CREATED", ticketId: ticket.id, guest: !customer };
}
