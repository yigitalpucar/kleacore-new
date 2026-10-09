import type { TicketSource } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { ticketCreateSchema } from "@/lib/validations/ticket";
import { validateAttachments, type AttachmentInput } from "./attachments";
import { canReplyToTickets } from "./access";
import {
  appendTicketMessage,
  emitTicketClosed,
  statusChange,
  createTicketRecord,
  MAX_MESSAGE_LENGTH,
  STAFF_REPLY_STATUSES,
  withStoredAttachments,
  type StaffReplyStatus,
} from "./tickets";

const log = createLogger("support.web");

/** Result shape shared with the existing server actions ({ success, error, data }). */
export type WebResult<T = undefined> = { success: true; data?: T; status?: number } | { success: false; error: string; status: number };

export interface WebActor {
  id: string;
  role?: string | null;
}

function fail(error: string, status = 400): WebResult<never> {
  return { success: false, error, status };
}

async function displayName(userId: string, fallback: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, surname: true } });
  return user ? `${user.name} ${user.surname}`.trim() || fallback : fallback;
}

function revalidateTicket(ticketId?: string) {
  try {
    revalidatePath("/musteri/panel/destek");
    revalidatePath("/yonetim/destek");
    if (ticketId) {
      revalidatePath(`/musteri/panel/destek/${ticketId}`);
      revalidatePath(`/yonetim/destek/${ticketId}`);
    }
  } catch {
    // Outside a request (tests / jobs) there is no cache to revalidate.
  }
}

export interface CustomerTicketForm {
  subject: string;
  department?: string;
  priority?: string;
  message: string;
  relatedServiceId?: string;
}

/** Customer "Yeni destek talebi" with optional files. */
export async function createCustomerTicket(
  actor: WebActor,
  form: CustomerTicketForm,
  uploads: AttachmentInput[]
): Promise<WebResult<{ id: string; ticketNumber: string }>> {
  const parsed = ticketCreateSchema.safeParse({
    subject: form.subject,
    department: form.department || undefined,
    priority: form.priority || undefined,
    message: form.message,
    relatedServiceId: form.relatedServiceId || undefined,
  });
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Geçersiz bilgiler", 422);
  if (parsed.data.message.length > MAX_MESSAGE_LENGTH) return fail("Mesaj çok uzun", 422);

  const files = validateAttachments(uploads);
  if (!files.ok) return fail(files.error, 422);

  if (parsed.data.relatedServiceId) {
    const service = await db.service.findFirst({
      where: { id: parsed.data.relatedServiceId, customerId: actor.id },
      select: { id: true },
    });
    if (!service) return fail("Seçilen hizmet bulunamadı", 422);
  }

  const senderName = await displayName(actor.id, "Müşteri");
  try {
    const { ticket } = await withStoredAttachments(files.files, (tx, stored) =>
      createTicketRecord(
        tx,
        {
          customerId: actor.id,
          subject: parsed.data.subject,
          department: parsed.data.department ?? "GENERAL",
          priority: parsed.data.priority ?? "MEDIUM",
          relatedServiceId: parsed.data.relatedServiceId ?? null,
          source: "WEB",
          author: { senderId: actor.id, senderName, senderRole: "CUSTOMER" },
          message: parsed.data.message,
        },
        stored
      )
    );
    revalidateTicket();
    return { success: true, data: { id: ticket.id, ticketNumber: ticket.ticketNumber }, status: 201 };
  } catch (error) {
    log.error("ticket create failed", { error });
    return fail("Destek talebi oluşturulurken bir hata oluştu", 500);
  }
}

/** Customer reply (own ticket only, not closed). */
export async function addCustomerReply(
  actor: WebActor,
  ticketId: string,
  rawMessage: string,
  uploads: AttachmentInput[]
): Promise<WebResult> {
  const message = rawMessage.trim();
  if (!message) return fail("Mesaj boş olamaz", 422);
  if (message.length > MAX_MESSAGE_LENGTH) return fail("Mesaj çok uzun", 422);

  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
  // Someone else's ticket answers like a missing one (no existence leak).
  if (!ticket || ticket.customerId !== actor.id) return fail("Destek talebi bulunamadı", 404);
  if (ticket.status === "CLOSED") return fail("Kapalı destek taleplerine yanıt verilemez", 409);

  const files = validateAttachments(uploads);
  if (!files.ok) return fail(files.error, 422);

  const senderName = await displayName(actor.id, "Müşteri");
  try {
    await withStoredAttachments(files.files, (tx, stored) =>
      appendTicketMessage(
        tx,
        {
          ticketId,
          author: { senderId: actor.id, senderName, senderRole: "CUSTOMER" },
          message,
          source: "WEB",
          nextStatus: "CUSTOMER_REPLY",
        },
        stored
      )
    );
  } catch (error) {
    log.error("customer reply failed", { ticketId, error });
    return fail("Yanıt gönderilirken bir hata oluştu", 500);
  }

  revalidateTicket(ticketId);
  return { success: true };
}

/** Staff reply; `status` = ADMIN_REPLY (default) | WAITING ("müşteri yanıtı bekleniyor") | CLOSED. */
export async function addStaffReply(
  actor: WebActor,
  ticketId: string,
  rawMessage: string,
  rawStatus: string | undefined,
  uploads: AttachmentInput[],
  source: TicketSource = "WEB"
): Promise<WebResult> {
  if (!canReplyToTickets(actor.role)) return fail("Yetkisiz erişim", 403);
  const message = rawMessage.trim();
  if (!message) return fail("Mesaj boş olamaz", 422);
  if (message.length > MAX_MESSAGE_LENGTH) return fail("Mesaj çok uzun", 422);
  const status: StaffReplyStatus = STAFF_REPLY_STATUSES.includes(rawStatus as StaffReplyStatus)
    ? (rawStatus as StaffReplyStatus)
    : "ADMIN_REPLY";

  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return fail("Destek talebi bulunamadı", 404);
  if (ticket.status === "CLOSED") return fail("Kapalı destek taleplerine yanıt verilemez", 409);

  const files = validateAttachments(uploads);
  if (!files.ok) return fail(files.error, 422);

  const senderName = await displayName(actor.id, "Destek ekibi");
  try {
    await withStoredAttachments(files.files, (tx, stored) =>
      appendTicketMessage(
        tx,
        {
          ticketId,
          author: { senderId: actor.id, senderName, senderRole: "ADMIN" },
          message,
          source,
          nextStatus: status,
        },
        stored
      )
    );
  } catch (error) {
    log.error("staff reply failed", { ticketId, error });
    return fail("Yanıt gönderilirken bir hata oluştu", 500);
  }

  revalidateTicket(ticketId);
  return { success: true };
}

/** Staff "Kapat" (admin action and admin API); emits ticket.closed. */
export async function closeTicketByStaff(ticketId: string): Promise<WebResult> {
  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId }, select: { status: true } });
  if (!ticket) return fail("Destek talebi bulunamadı", 404);
  if (ticket.status === "CLOSED") return fail("Bu talep zaten kapalı", 409);

  await db.$transaction(async (tx) => {
    const closed = await tx.supportTicket.update({
      where: { id: ticketId },
      data: statusChange("CLOSED"),
      select: { id: true, ticketNumber: true, subject: true, customerId: true },
    });
    await emitTicketClosed(tx, closed, "staff");
  });

  revalidateTicket(ticketId);
  return { success: true };
}
