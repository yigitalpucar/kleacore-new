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
import { generateTicketNumber } from "@/lib/utils/number-generators";
import { discardStoredAttachments, storeAttachments, type StoredAttachment, type ValidAttachment } from "./attachments";

type Tx = Prisma.TransactionClient;

const PREVIEW_LIMIT = 600;
const preview = (message: string) => message.slice(0, PREVIEW_LIMIT);

/** Ticket source as recorded on the domain event ("panel" / "email" / "api"). */
const EVENT_SOURCE: Record<TicketSource, string> = { WEB: "panel", EMAIL: "email", API: "api" };

const TICKET_EVENT_SELECT = {
  id: true,
  ticketNumber: true,
  subject: true,
  customerId: true,
  department: true,
  guestEmail: true,
  guestName: true,
} satisfies Prisma.SupportTicketSelect;

type TicketEventRef = { id: string; ticketNumber: string; subject: string; customerId: string | null };

/**
 * ticket.closed through the outbox, in the transaction that closed it.
 * `closedBy`: "staff" | "customer" | "auto".
 */
export async function emitTicketClosed(tx: Tx, ticket: TicketEventRef | string, closedBy: "staff" | "customer" | "auto") {
  const ref =
    typeof ticket === "string"
      ? await tx.supportTicket.findUniqueOrThrow({ where: { id: ticket }, select: TICKET_EVENT_SELECT })
      : ticket;
  await emitEvent(tx, "ticket.closed", {
    ticketId: ref.id,
    ticketNumber: ref.ticketNumber,
    subject: ref.subject,
    customerId: ref.customerId,
    closedBy,
  });
}

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
    subject: ticket.subject,
    customerId: input.customerId,
    customerName: input.author.senderName,
    department: input.department,
    priority: input.priority,
    messagePreview: preview(input.message),
    source: EVENT_SOURCE[input.source],
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
  const ticket = await tx.supportTicket.update({
    where: { id: input.ticketId },
    data: statusChange(input.nextStatus),
    select: TICKET_EVENT_SELECT,
  });
  const fromCustomer = input.author.senderRole === "CUSTOMER";
  await emitEvent(tx, "ticket.replied", {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    customerId: ticket.customerId,
    department: ticket.department,
    authorRole: fromCustomer ? "CUSTOMER" : "STAFF",
    senderName: input.author.senderName,
    messagePreview: preview(input.message),
    // Guest (e-mail) tickets have no account: the staff reply goes to the guest address.
    ...(!fromCustomer && !ticket.customerId && ticket.guestEmail
      ? { recipientEmail: ticket.guestEmail, recipientName: ticket.guestName ?? undefined }
      : {}),
  });
  if (input.nextStatus === "CLOSED") {
    await emitTicketClosed(tx, ticket, "staff");
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

// ── notifications ────────────────────────────────────────────────────────
// Customer/staff mails for ticket.opened / ticket.replied are sent by the
// event subscribers (src/lib/events/subscribers); this only resolves the
// Reply-To address they put on customer mails.

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
