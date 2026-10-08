"use server";

import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { statusChange } from "@/lib/support/tickets";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

// New tickets and replies (with file uploads) go through the multipart routes
// POST /api/support/tickets and /api/support/tickets/[id]/messages
// (src/lib/support/web.ts); Server Actions are capped at 1 MB bodies.

function revalidateTicket(ticketId: string) {
  revalidatePath(`/musteri/panel/destek/${ticketId}`);
  revalidatePath("/musteri/panel/destek");
  revalidatePath(`/yonetim/destek/${ticketId}`);
  revalidatePath("/yonetim/destek");
}

export async function closeTicket(ticketId: string) {
  const session = await requireCustomer();

  try {
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.customerId !== session.user.id) {
      return { success: false, error: "Destek talebi bulunamadı" };
    }

    if (ticket.status === "CLOSED") {
      return { success: false, error: "Bu talep zaten kapalı" };
    }

    await db.$transaction(async (tx) => {
      await tx.supportTicket.update({ where: { id: ticketId }, data: statusChange("CLOSED") });
      await emitEvent(tx, "ticket.closed", { ticketId, reason: "customer" });
    });

    revalidateTicket(ticketId);
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

    if (!ticket || ticket.customerId !== session.user.id) {
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
