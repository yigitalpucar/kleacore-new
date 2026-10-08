"use server";

import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";
import { sendNotification } from "@/lib/notifications/send";

function revalidateCancellationPaths(serviceId: string, orderId?: string | null) {
  revalidatePath(`/musteri/panel/hizmetlerim/${serviceId}`);
  revalidatePath("/musteri/panel/hizmetlerim");
  revalidatePath("/yonetim/siparisler/iptal-talepleri");
  if (orderId) {
    revalidatePath(`/yonetim/siparisler/${orderId}`);
  }
}

export async function submitCancellationRequest(serviceId: string, reason: string) {
  const session = await requireCustomer();

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 10) {
    return { success: false, error: "İptal nedeni en az 10 karakter olmalıdır" };
  }

  if (trimmedReason.length > 1000) {
    return { success: false, error: "İptal nedeni en fazla 1000 karakter olabilir" };
  }

  try {
    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        customerId: true,
        status: true,
        label: true,
        domain: true,
        product: { select: { name: true } },
      },
    });

    if (!service) {
      return { success: false, error: "Hizmet bulunamadı" };
    }

    if (service.customerId !== session.user.id) {
      return { success: false, error: "Bu hizmete erişim yetkiniz yok" };
    }

    if (service.status === "CANCELLED") {
      return { success: false, error: "Bu hizmet zaten iptal edilmiş" };
    }

    if (service.status === "EXPIRED") {
      return { success: false, error: "Süresi dolmuş hizmetler için iptal talebi oluşturulamaz" };
    }

    const existingPending = await db.cancellationRequest.findFirst({
      where: {
        serviceId,
        customerId: session.user.id,
        status: "PENDING",
      },
    });

    if (existingPending) {
      return { success: false, error: "Bu hizmet için zaten bekleyen bir iptal talebiniz var" };
    }

    const order = await db.order.findFirst({
      where: { serviceId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    });

    const request = await db.$transaction(async (tx) => {
      const created = await tx.cancellationRequest.create({
        data: {
          customerId: session.user.id,
          serviceId,
          orderId: order?.id ?? null,
          reason: trimmedReason,
          status: "PENDING",
        },
      });

      if (order) {
        await tx.order.update({
          where: { id: order.id },
          data: { cancellationReason: trimmedReason },
        });

        await tx.orderActivity.create({
          data: {
            orderId: order.id,
            action: "CANCELLATION_REQUESTED",
            description: `Müşteri iptal talebi: ${trimmedReason}`,
            performedBy: session.user.id,
          },
        });
      }

      await sendNotification({
        userId: session.user.id,
        template: "service.cancellation-received",
        data: {
          serviceId,
          serviceLabel: service.label || service.domain || service.product.name,
          reason: trimmedReason,
        },
        dedupeKey: `cancellation.received:${created.id}`,
        tx,
      });

      return created;
    });

    revalidateCancellationPaths(serviceId, order?.id);
    return { success: true, requestId: request.id };
  } catch {
    return { success: false, error: "İptal talebi gönderilirken bir hata oluştu" };
  }
}