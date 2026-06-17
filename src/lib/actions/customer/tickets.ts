"use server";

import { db } from "@/lib/db";
import {
  dispatchNotification,
  loadSupportNotificationEmail,
  sendTicketReplyEmail,
} from "@/lib/notifications/email";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { generateTicketNumber } from "@/lib/utils/number-generators";
import { ticketCreateSchema } from "@/lib/validations/ticket";
import { revalidatePath } from "next/cache";

type TicketAttachment = {
  name: string;
  size: string;
  type: "image" | "document";
};

function parseAttachments(payload: FormDataEntryValue | null): TicketAttachment[] {
  if (typeof payload !== "string" || payload.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is TicketAttachment => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as Record<string, unknown>;
        return (
          typeof candidate.name === "string" &&
          typeof candidate.size === "string" &&
          (candidate.type === "image" || candidate.type === "document")
        );
      })
      .slice(0, 10);
  } catch {
    return [];
  }
}

export async function createTicket(formData: FormData) {
  const session = await requireCustomer();

  try {
    const raw = {
      subject: formData.get("subject") as string,
      department: (formData.get("department") as string) || undefined,
      priority: (formData.get("priority") as string) || undefined,
      message: formData.get("message") as string,
      relatedServiceId: (formData.get("relatedServiceId") as string) || undefined,
    };

    const parsed = ticketCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Geçersiz bilgiler",
      };
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, surname: true },
    });

    const senderName = user
      ? `${user.name} ${user.surname}`.trim()
      : "Müşteri";

    const ticketNumber = generateTicketNumber();
    const attachments = parseAttachments(formData.get("attachments"));

    const ticket = await db.supportTicket.create({
      data: {
        ticketNumber,
        customerId: session.user.id,
        subject: parsed.data.subject,
        department: parsed.data.department ?? "GENERAL",
        priority: parsed.data.priority ?? "MEDIUM",
        status: "OPEN",
        relatedServiceId: parsed.data.relatedServiceId ?? null,
        messages: {
          create: {
            senderId: session.user.id,
            senderName,
            senderRole: "CUSTOMER",
            message: parsed.data.message,
            attachments,
          },
        },
      },
    });

    revalidatePath("/musteri/panel/destek");
    return {
      success: true,
      data: { id: ticket.id, ticketNumber: ticket.ticketNumber },
    };
  } catch {
    return { success: false, error: "Destek talebi oluşturulurken bir hata oluştu" };
  }
}

export async function replyToTicket(ticketId: string, message: string) {
  const session = await requireCustomer();

  try {
    if (!message || message.trim().length === 0) {
      return { success: false, error: "Mesaj boş olamaz" };
    }

    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return { success: false, error: "Destek talebi bulunamadı" };
    }

    if (ticket.customerId !== session.user.id) {
      return { success: false, error: "Bu talebe erişim yetkiniz yok" };
    }

    if (ticket.status === "CLOSED") {
      return { success: false, error: "Kapalı destek taleplerine yanıt verilemez" };
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, surname: true },
    });

    const senderName = user
      ? `${user.name} ${user.surname}`.trim()
      : "Müşteri";

    const trimmedMessage = message.trim();

    await db.$transaction([
      db.ticketMessage.create({
        data: {
          ticketId,
          senderId: session.user.id,
          senderName,
          senderRole: "CUSTOMER",
          message: trimmedMessage,
        },
      }),
      db.supportTicket.update({
        where: { id: ticketId },
        data: { status: "CUSTOMER_REPLY" },
      }),
    ]);

    dispatchNotification(async () => {
      const supportEmail = await loadSupportNotificationEmail();
      if (!supportEmail) {
        console.info("[Notifications] Destek bildirim e-postası yapılandırılmamış");
        return;
      }

      await sendTicketReplyEmail({
        recipientEmail: supportEmail,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ticketSubject: ticket.subject,
        senderName,
        messagePreview: trimmedMessage,
        recipientRole: "ADMIN",
      });
    });

    revalidatePath(`/musteri/panel/destek/${ticketId}`);
    revalidatePath("/musteri/panel/destek");
    revalidatePath(`/yonetim/destek/${ticketId}`);
    revalidatePath("/yonetim/destek");
    return { success: true };
  } catch {
    return { success: false, error: "Yanıt gönderilirken bir hata oluştu" };
  }
}

export async function closeTicket(ticketId: string) {
  const session = await requireCustomer();

  try {
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return { success: false, error: "Destek talebi bulunamadı" };
    }

    if (ticket.customerId !== session.user.id) {
      return { success: false, error: "Bu talebe erişim yetkiniz yok" };
    }

    if (ticket.status === "CLOSED") {
      return { success: false, error: "Bu talep zaten kapalı" };
    }

    await db.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
      },
    });

    revalidatePath(`/musteri/panel/destek/${ticketId}`);
    revalidatePath("/musteri/panel/destek");
    revalidatePath(`/yonetim/destek/${ticketId}`);
    revalidatePath("/yonetim/destek");
    return { success: true };
  } catch {
    return { success: false, error: "Talep kapatılırken bir hata oluştu" };
  }
}

export async function reopenTicket(ticketId: string) {
  const session = await requireCustomer();

  try {
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return { success: false, error: "Destek talebi bulunamadı" };
    }

    if (ticket.customerId !== session.user.id) {
      return { success: false, error: "Bu talebe erişim yetkiniz yok" };
    }

    if (ticket.status !== "CLOSED") {
      return { success: false, error: "Sadece kapalı talepler yeniden açılabilir" };
    }

    await db.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: "OPEN",
        closedAt: null,
      },
    });

    revalidatePath(`/musteri/panel/destek/${ticketId}`);
    revalidatePath("/musteri/panel/destek");
    revalidatePath(`/yonetim/destek/${ticketId}`);
    revalidatePath("/yonetim/destek");
    return { success: true };
  } catch {
    return { success: false, error: "Talep yeniden açılırken bir hata oluştu" };
  }
}
