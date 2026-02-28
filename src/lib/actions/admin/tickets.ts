"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

export async function replyToTicket(ticketId: string, message: string) {
  const session = await requireAdmin();

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

    await db.$transaction([
      db.ticketMessage.create({
        data: {
          ticketId,
          senderId: session.user.id,
          senderName,
          senderRole: "ADMIN",
          message: message.trim(),
        },
      }),
      db.supportTicket.update({
        where: { id: ticketId },
        data: { status: "ADMIN_REPLY" },
      }),
    ]);

    revalidatePath(`/yonetim/destek/${ticketId}`);
    revalidatePath("/yonetim/destek");
    return { success: true };
  } catch {
    return { success: false, error: "Yanıt gönderilirken bir hata oluştu" };
  }
}

export async function assignTicket(ticketId: string, adminId: string) {
  await requireAdmin();

  try {
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      return { success: false, error: "Destek talebi bulunamadı" };
    }

    const admin = await db.user.findUnique({
      where: { id: adminId, role: "ADMIN" },
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
  await requireAdmin();

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
  await requireAdmin();

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
