"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";
import { sendNotification } from "@/lib/notifications/send";

function revalidateCancellationPaths(request: {
  id: string;
  orderId?: string | null;
  serviceId?: string | null;
}) {
  revalidatePath("/yonetim/siparisler");
  revalidatePath("/yonetim/siparisler/iptal");
  revalidatePath("/yonetim/siparisler/iptal-talepleri");
  if (request.orderId) {
    revalidatePath(`/yonetim/siparisler/${request.orderId}`);
  }
  if (request.serviceId) {
    revalidatePath(`/musteri/panel/hizmetlerim/${request.serviceId}`);
    revalidatePath("/musteri/panel/hizmetlerim");
  }
}

export async function approveCancellationRequest(requestId: string) {
  const session = await requirePermission("orders.manage");

  try {
    const request = await db.cancellationRequest.findUnique({
      where: { id: requestId },
      include: {
        order: true,
        service: { include: { product: { select: { name: true } } } },
      },
    });

    if (!request) {
      return { success: false, error: "İptal talebi bulunamadı" };
    }

    if (request.status !== "PENDING") {
      return { success: false, error: "Bu talep zaten işlenmiş" };
    }

    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.cancellationRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          resolvedAt: now,
        },
      });

      if (request.serviceId) {
        await tx.service.update({
          where: { id: request.serviceId },
          data: {
            status: "CANCELLED",
            cancelledAt: now,
          },
        });
      }

      if (request.order) {
        if (request.order.status !== "CANCELLED" && request.order.status !== "REFUNDED") {
          await tx.order.update({
            where: { id: request.order.id },
            data: {
              status: "CANCELLED",
              cancelledAt: now,
              cancellationReason: request.reason,
            },
          });
        }

        await tx.orderActivity.create({
          data: {
            orderId: request.order.id,
            action: "CANCELLATION_REQUEST_APPROVED",
            description: `İptal talebi onaylandı: ${request.reason}`,
            performedBy: session.user.id,
          },
        });
      }

      if (request.service) {
        await sendNotification({
          userId: request.customerId,
          template: "service.cancellation-approved",
          data: {
            serviceId: request.service.id,
            serviceLabel: request.service.label || request.service.domain || request.service.product.name,
            cancelledAt: now,
          },
          dedupeKey: `cancellation.approved:${request.id}`,
          tx,
        });
      }
    });

    revalidateCancellationPaths(request);
    return { success: true };
  } catch {
    return { success: false, error: "İptal talebi onaylanırken bir hata oluştu" };
  }
}

export async function rejectCancellationRequest(requestId: string, reason?: string) {
  const session = await requirePermission("orders.manage");

  try {
    const request = await db.cancellationRequest.findUnique({
      where: { id: requestId },
      include: { order: true },
    });

    if (!request) {
      return { success: false, error: "İptal talebi bulunamadı" };
    }

    if (request.status !== "PENDING") {
      return { success: false, error: "Bu talep zaten işlenmiş" };
    }

    const note = reason?.trim() || "Sebep belirtilmedi";
    const adminNote = `İptal talebi reddedildi: ${note}`;
    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.cancellationRequest.update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          resolvedAt: now,
          adminNotes: note,
        },
      });

      if (request.order) {
        await tx.order.update({
          where: { id: request.order.id },
          data: {
            cancellationReason: null,
            adminNotes: request.order.adminNotes
              ? `${request.order.adminNotes}\n${adminNote}`
              : adminNote,
          },
        });

        await tx.orderActivity.create({
          data: {
            orderId: request.order.id,
            action: "CANCELLATION_REQUEST_REJECTED",
            description: adminNote,
            performedBy: session.user.id,
          },
        });
      }
    });

    revalidateCancellationPaths(request);
    return { success: true };
  } catch {
    return { success: false, error: "İptal talebi reddedilirken bir hata oluştu" };
  }
}