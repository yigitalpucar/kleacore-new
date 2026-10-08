"use server";

import { db } from "@/lib/db";
import { dispatchNotification, sendTicketReplyEmail } from "@/lib/notifications/email";
import { STAFF_ROLES } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

export async function replyToTicket(ticketId: string, message: string) {
  const session = await requirePermission("tickets.reply");

  try {
    if (!message || message.trim().length === 0) {
      return { success: false, error: "Mesaj boş olamaz" };
    }

    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            name: true,
            surname: true,
          },
        },
      },
    });
    if (!ticket) {
      return { success: false, error: "Destek talebi bulunamadı" };
    }

    if (ticket.status === "CLOSED") {
      return { success: false, error: "Kapalı destek taleplerine yanıt verilemez" };
    }

    const admin = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, surname: true },
    });

    const senderName = admin
      ? `${admin.name} ${admin.surname}`.trim()
      : "Admin";

    const trimmedMessage = message.trim();

    await db.$transaction([
      db.ticketMessage.create({
        data: {
          ticketId,
          senderId: session.user.id,
          senderName,
          senderRole: "ADMIN",
          message: trimmedMessage,
        },
      }),
      db.supportTicket.update({
        where: { id: ticketId },
        data: { status: "ADMIN_REPLY" },
      }),
    ]);

    dispatchNotification(async () => {
      await sendTicketReplyEmail({
        recipientEmail: ticket.customer.email,
        recipientName: `${ticket.customer.name} ${ticket.customer.surname}`.trim(),
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ticketSubject: ticket.subject,
        senderName,
        messagePreview: trimmedMessage,
        recipientRole: "CUSTOMER",
        customerId: ticket.customer.id,
      });
    });

    revalidatePath(`/yonetim/destek/${ticketId}`);
    revalidatePath("/yonetim/destek");
    return { success: true };
  } catch {
    return { success: false, error: "Yanıt gönderilirken bir hata oluştu" };
  }
}

export async function assignTicket(ticketId: string, adminId: string) {
  await requirePermission("tickets.reply");

  try {
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      return { success: false, error: "Destek talebi bulunamadı" };
    }

    const admin = await db.user.findUnique({
      where: { id: adminId, role: { in: [...STAFF_ROLES] }, status: "ACTIVE" },
    });
    if (!admin) {
      return { success: false, error: "Geçersiz admin kullanıcı" };
    }

    await db.supportTicket.update({
      where: { id: ticketId },
      data: { assignedTo: adminId },
    });

    revalidatePath(`/yonetim/destek/${ticketId}`);
    revalidatePath("/yonetim/destek");
    return { success: true };
  } catch {
    return { success: false, error: "Talep atanırken bir hata oluştu" };
  }
}

export async function closeTicket(ticketId: string) {
  await requirePermission("tickets.reply");

  try {
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      return { success: false, error: "Destek talebi bulunamadı" };
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

    revalidatePath(`/yonetim/destek/${ticketId}`);
    revalidatePath("/yonetim/destek");
    revalidatePath(`/musteri/panel/destek/${ticketId}`);
    revalidatePath("/musteri/panel/destek");
    return { success: true };
  } catch {
    return { success: false, error: "Talep kapatılırken bir hata oluştu" };
  }
}

export async function reopenTicket(ticketId: string) {
  await requirePermission("tickets.reply");

  try {
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      return { success: false, error: "Destek talebi bulunamadı" };
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

    revalidatePath(`/yonetim/destek/${ticketId}`);
    revalidatePath("/yonetim/destek");
    revalidatePath(`/musteri/panel/destek/${ticketId}`);
    revalidatePath("/musteri/panel/destek");
    return { success: true };
  } catch {
    return { success: false, error: "Talep yeniden açılırken bir hata oluştu" };
  }
}
