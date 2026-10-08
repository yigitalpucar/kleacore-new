import type {
  Prisma,
  TicketDepartment,
  TicketPriority,
  TicketSource,
  TicketStatus,
  UserRole,
} from "@prisma/client";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { createLogger } from "@/lib/logger";
import { sendNotification } from "@/lib/notifications/send";
import { generateTicketNumber } from "@/lib/utils/number-generators";
import { discardStoredAttachments, storeAttachments, type StoredAttachment, type ValidAttachment } from "./attachments";

const log = createLogger("support.tickets");

type Tx = Prisma.TransactionClient;

/** Statuses meaning "waiting on the customer" (auto-close candidates). */
export const AWAITING_CUSTOMER_STATUSES: TicketStatus[] = ["ADMIN_REPLY", "WAITING"];

/** What a staff reply may set: answered, explicitly waiting on the customer, or answered + closed. */
export type StaffReplyStatus = "ADMIN_REPLY" | "WAITING" | "CLOSED";
export const STAFF_REPLY_STATUSES: StaffReplyStatus[] = ["ADMIN_REPLY", "WAITING", "CLOSED"];

export const MAX_MESSAGE_LENGTH = 50_000;

export interface MessageAuthor {
  senderId: string;
  senderName: string;
  senderRole: UserRole;
}

/**
 * Ticket fields to update when the status changes. Keeps the auto-close
 * clock consistent everywhere: it starts when the ball goes to the customer
 * and stops on anything else.
 */
export function statusChange(
  status: TicketStatus,
  now = new Date()
): { status: TicketStatus; closedAt: Date | null; waitingSince: Date | null; autoCloseWarnedAt: null } {
  if (status === "CLOSED") {
    return { status, closedAt: now, waitingSince: null, autoCloseWarnedAt: null };
  }
  if (AWAITING_CUSTOMER_STATUSES.includes(status)) {
    return { status, closedAt: null, waitingSince: now, autoCloseWarnedAt: null };
  }
  return { status, closedAt: null, waitingSince: null, autoCloseWarnedAt: null };
}

async function createAttachmentRows(tx: Tx, ticketId: string, messageId: string, files: StoredAttachment[]) {
  if (files.length === 0) return;
  await tx.ticketAttachment.createMany({
    data: files.map((file) => ({ ticketId, messageId, ...file })),
  });
}

async function uniqueTicketNumber(tx: Tx) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateTicketNumber();
    const taken = await tx.supportTicket.findUnique({ where: { ticketNumber: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  throw new Error("TICKET_NUMBER_UNAVAILABLE");
}

export interface CreateTicketInput {
  customerId: string | null;
  guestEmail?: string | null;
  guestName?: string | null;
  subject: string;
  department: TicketDepartment;
  priority: TicketPriority;
  relatedServiceId?: string | null;
  source: TicketSource;
  author: MessageAuthor;
  message: string;
}

/** Inside a transaction: ticket + first message + attachment rows + ticket.opened event. */
export async function createTicketRecord(tx: Tx, input: CreateTicketInput, files: StoredAttachment[] = []) {
  const ticketNumber = await uniqueTicketNumber(tx);
  const ticket = await tx.supportTicket.create({
    data: {
      ticketNumber,
      customerId: input.customerId,
      guestEmail: input.guestEmail ?? null,
      guestName: input.guestName ?? null,
      source: input.source,
      subject: input.subject.slice(0, 250),
      department: input.department,
      priority: input.priority,
      status: "OPEN",
      relatedServiceId: input.relatedServiceId ?? null,
      messages: {
        create: {
          ...input.author,
          message: input.message.slice(0, MAX_MESSAGE_LENGTH),
          source: input.source,
        },
      },
    },
    include: { messages: { select: { id: true } } },
  });
  const messageId = ticket.messages[0].id;
  await createAttachmentRows(tx, ticket.id, messageId, files);
  await emitEvent(tx, "ticket.opened", {
    ticketId: ticket.id,
    ticketNumber,
    customerId: input.customerId,
    source: input.source,
    department: input.department,
    priority: input.priority,
  });
  return { ticket, messageId };
}

export interface AppendMessageInput {
  ticketId: string;
  author: MessageAuthor;
  message: string;
  source: TicketSource;
  /** Status after the message: a customer message always → CUSTOMER_REPLY. */
  nextStatus: TicketStatus;
}

/** Inside a transaction: message + attachment rows + status/clock update + ticket.replied event. */
export async function appendTicketMessage(tx: Tx, input: AppendMessageInput, files: StoredAttachment[] = []) {
  const message = await tx.ticketMessage.create({
    data: {
      ticketId: input.ticketId,
      ...input.author,
      message: input.message.slice(0, MAX_MESSAGE_LENGTH),
      source: input.source,
    },
    select: { id: true },
  });
  await createAttachmentRows(tx, input.ticketId, message.id, files);
  await tx.supportTicket.update({ where: { id: input.ticketId }, data: statusChange(input.nextStatus) });
  await emitEvent(tx, "ticket.replied", {
    ticketId: input.ticketId,
    messageId: message.id,
    senderRole: input.author.senderRole,
    source: input.source,
    status: input.nextStatus,
  });
  if (input.nextStatus === "CLOSED") {
    await emitEvent(tx, "ticket.closed", { ticketId: input.ticketId, reason: "staff" });
  }
  return { messageId: message.id };
}

/**
 * Stores the files, then runs `write` in a transaction; if the transaction
 * fails the stored files are deleted again, so no orphan objects remain.
 */
export async function withStoredAttachments<T>(
  files: ValidAttachment[],
  write: (tx: Tx, stored: StoredAttachment[]) => Promise<T>
): Promise<T> {
  const stored = files.length ? await storeAttachments(files) : [];
  try {
    return await db.$transaction((tx) => write(tx, stored));
  } catch (error) {
    await discardStoredAttachments(stored);
    throw error;
  }
}

// ── notifications (after commit, never fail the caller) ──────────────────

/** Reply-To for ticket mails: the active mailbox of the department, else any active mailbox. */
export async function supportReplyAddress(department?: TicketDepartment | null): Promise<string | undefined> {
  const mailboxes = await db.supportMailbox.findMany({
    where: { isActive: true },
    select: { address: true, department: true },
    orderBy: { createdAt: "asc" },
  });
  const match = mailboxes.find((m) => m.department === department) ?? mailboxes.find((m) => !m.department) ?? mailboxes[0];
  return match?.address || undefined;
}

export interface TicketRecipient {
  id: string;
  ticketNumber: string;
  subject: string;
  department: TicketDepartment;
  customerId: string | null;
  guestEmail: string | null;
  guestName: string | null;
}

/** "Destek talebiniz yanıtlandı" to the customer (account) or the guest address. */
export async function notifyCustomerOfStaffReply(ticket: TicketRecipient, senderName: string, message: string) {
  const to = ticket.customerId ? undefined : ticket.guestEmail ?? undefined;
  if (!ticket.customerId && !to) return;
  const replyTo = await supportReplyAddress(ticket.department).catch(() => undefined);
  await sendNotification({
    userId: ticket.customerId,
    to,
    template: "support.ticket-replied",
    channel: "EMAIL",
    data: {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      ticketSubject: ticket.subject,
      senderName,
      messagePreview: message,
      ...(ticket.customerId ? {} : { recipientName: ticket.guestName ?? undefined }),
      ...(replyTo ? { replyTo } : {}),
    },
  });
}

/** Staff copy of a customer message (support / company address). */
export async function notifyStaffOfCustomerReply(ticket: TicketRecipient, senderName: string, message: string) {
  try {
    const { loadSupportNotificationEmail } = await import("@/lib/notifications/email");
    const supportEmail = await loadSupportNotificationEmail();
    if (!supportEmail) return;
    await sendNotification({
      template: "admin.ticket-customer-reply",
      to: supportEmail,
      channel: "EMAIL",
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ticketSubject: ticket.subject,
        senderName,
        messagePreview: message,
      },
    });
  } catch (error) {
    log.warn("staff ticket notification failed", { ticketId: ticket.id, error });
  }
}
