"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

function revalidateCancellationPaths(orderId: string) {
  revalidatePath("/yonetim/siparisler");
  revalidatePath("/yonetim/siparisler/iptal");
  revalidatePath("/yonetim/siparisler/iptal-talepleri");
  revalidatePath(`/yonetim/siparisler/${orderId}`);
}

export async function approveCancellationRequest(orderId: string) {
  const session = await requireAdmin();

  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      return { success: false, error: "Sipariş bulunamadı" };
    }

    if (!order.cancellationReason) {
      return { success: false, error: "Bu sipariş için aktif bir iptal talebi yok" };
    }

    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      return { success: true };
    }

    await db.$transaction([
      db.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: order.cancellationReason,
        },
      }),
      db.orderActivity.create({
        data: {
          orderId,
          action: "CANCELLATION_REQUEST_APPROVED",
          description: `İptal talebi onaylandı: ${order.cancellationReason}`,
          performedBy: session.user.id,
        },
      }),
    ]);

    revalidateCancellationPaths(orderId);
    return { success: true };
  } catch {
    return { success: false, error: "İptal talebi onaylanırken bir hata oluştu" };
  }
}

export async function rejectCancellationRequest(orderId: string, reason?: string) {
  const session = await requireAdmin();

  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      return { success: false, error: "Sipariş bulunamadı" };
    }

    if (!order.cancellationReason) {
      return { success: false, error: "Bu sipariş için aktif bir iptal talebi yok" };
    }

    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      return { success: false, error: "İptal edilen siparişin talebi reddedilemez" };
    }

    const note = reason?.trim() || "Sebep belirtilmedi";
    const adminNote = `İptal talebi reddedildi: ${note}`;

    await db.$transaction([
      db.order.update({
        where: { id: orderId },
        data: {
          cancellationReason: null,
          adminNotes: order.adminNotes
            ? `${order.adminNotes}\n${adminNote}`
            : adminNote,
        },
      }),
      db.orderActivity.create({
        data: {
          orderId,
          action: "CANCELLATION_REQUEST_REJECTED",
          description: adminNote,
          performedBy: session.user.id,
        },
      }),
    ]);

    revalidateCancellationPaths(orderId);
    return { success: true };
  } catch {
    return { success: false, error: "İptal talebi reddedilirken bir hata oluştu" };
  }
}
