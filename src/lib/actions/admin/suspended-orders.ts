"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

function revalidateSuspendedOrderPaths(orderId: string) {
  revalidatePath("/yonetim/siparisler");
  revalidatePath("/yonetim/siparisler/askida");
  revalidatePath("/yonetim/siparisler/tum-siparisler");
  revalidatePath(`/yonetim/siparisler/${orderId}`);
  revalidatePath("/yonetim/hizmetler");
  revalidatePath("/yonetim/hizmetler/askida");
  revalidatePath("/yonetim/hizmetler/iptal");
}

export async function activateSuspendedOrder(orderId: string) {
  const session = await requireAdmin();

  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        serviceId: true,
      },
    });

    if (!order) {
      return { success: false, error: "Sipariş bulunamadı" };
    }

    if (!order.serviceId) {
      return { success: false, error: "Siparişe bağlı hizmet bulunamadı" };
    }

    const service = await db.service.findUnique({
      where: { id: order.serviceId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!service) {
      return { success: false, error: "Hizmet bulunamadı" };
    }

    if (service.status !== "SUSPENDED") {
      return { success: false, error: "Sadece askıdaki hizmetler aktifleştirilebilir" };
    }

    await db.$transaction([
      db.service.update({
        where: { id: service.id },
        data: {
          status: "ACTIVE",
          suspendedAt: null,
          suspendReason: null,
        },
      }),
      db.orderActivity.create({
        data: {
          orderId: order.id,
          action: "SERVICE_REACTIVATED",
          description: "Askıdaki hizmet yeniden aktifleştirildi",
          performedBy: session.user.id,
          metadata: {
            serviceId: service.id,
          },
        },
      }),
    ]);

    revalidateSuspendedOrderPaths(order.id);
    return { success: true };
  } catch {
    return { success: false, error: "Askıdaki sipariş aktifleştirilirken bir hata oluştu" };
  }
}

export async function cancelSuspendedOrder(orderId: string, reason?: string) {
  const session = await requireAdmin();

  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        serviceId: true,
      },
    });

    if (!order) {
      return { success: false, error: "Sipariş bulunamadı" };
    }

    if (!order.serviceId) {
      return { success: false, error: "Siparişe bağlı hizmet bulunamadı" };
    }

    const service = await db.service.findUnique({
      where: { id: order.serviceId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!service) {
      return { success: false, error: "Hizmet bulunamadı" };
    }

    if (service.status !== "SUSPENDED") {
      return { success: false, error: "Sadece askıdaki hizmetler iptal edilebilir" };
    }

    const reasonText =
      reason?.trim() || "Askıdaki hizmet yönetim panelinden iptal edildi";

    await db.$transaction([
      db.service.update({
        where: { id: service.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      }),
      db.orderActivity.create({
        data: {
          orderId: order.id,
          action: "SERVICE_CANCELLED",
          description: `Askıdaki hizmet iptal edildi: ${reasonText}`,
          performedBy: session.user.id,
          metadata: {
            serviceId: service.id,
            reason: reasonText,
          },
        },
      }),
    ]);

    revalidateSuspendedOrderPaths(order.id);
    return { success: true };
  } catch {
    return { success: false, error: "Askıdaki sipariş iptal edilirken bir hata oluştu" };
  }
}
