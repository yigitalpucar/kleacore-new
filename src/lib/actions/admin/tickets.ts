"use server";

import type { TicketStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { statusChange } from "@/lib/support/tickets";
import { STAFF_ROLES } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { closeTicketByStaff } from "@/lib/support/web";
import { revalidatePath } from "next/cache";

// Staff replies (with attachments) go through POST
// /api/admin/support/tickets/[id]/messages (src/lib/support/web.ts).

function revalidateTicket(ticketId: string) {
  revalidatePath(`/yonetim/destek/${ticketId}`);
  revalidatePath("/yonetim/destek");
  revalidatePath(`/musteri/panel/destek/${ticketId}`);
  revalidatePath("/musteri/panel/destek");
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
    return await closeTicketByStaff(ticketId);
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

    await db.supportTicket.update({ where: { id: ticketId }, data: statusChange("OPEN") });

    revalidateTicket(ticketId);
    return { success: true };
  } catch {
    return { success: false, error: "Talep yeniden açılırken bir hata oluştu" };
  }
}

const SETTABLE_STATUSES: TicketStatus[] = ["OPEN", "ADMIN_REPLY", "WAITING"];

/**
 * Status change without a reply, e.g. "Müşteri yanıtı bekleniyor" (WAITING):
 * starts the auto-close clock. Closing has its own action.
 */
export async function setTicketStatus(ticketId: string, status: TicketStatus) {
  await requirePermission("tickets.reply");
  if (!SETTABLE_STATUSES.includes(status)) return { success: false, error: "Geçersiz durum" };

  const result = await db.supportTicket.updateMany({
    where: { id: ticketId, status: { not: "CLOSED" } },
    data: statusChange(status),
  });
  if (result.count === 0) return { success: false, error: "Talep bulunamadı veya kapalı" };

  revalidateTicket(ticketId);
  return { success: true };
}

/**
 * Attaches a guest (e-mail) ticket to the customer account with that
 * address, after the staff member checked the sender.
 */
export async function linkTicketToCustomer(ticketId: string, customerEmail: string) {
  await requirePermission("tickets.reply");
  const email = customerEmail.trim().toLowerCase();
  const customer = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, role: "CUSTOMER" },
    select: { id: true },
  });
  if (!customer) return { success: false, error: "Bu e-posta adresiyle kayıtlı müşteri bulunamadı" };

  const result = await db.supportTicket.updateMany({
    where: { id: ticketId, customerId: null },
    data: { customerId: customer.id },
  });
  if (result.count === 0) return { success: false, error: "Talep bulunamadı veya zaten bir müşteriye bağlı" };

  revalidateTicket(ticketId);
  return { success: true };
}
