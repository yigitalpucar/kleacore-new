"use server";

import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { approveOrderAs } from "@/lib/orders/approve";
import { prepareOrderProvisioning } from "@/lib/provisioning/internal";
import { revalidatePath } from "next/cache";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin.orders");

export async function approveOrder(id: string) {
  const session = await requirePermission("orders.manage");

  try {
    const result = await approveOrderAs(session.user.id, id);
    if (!result.success) return result;

    revalidatePath("/yonetim/siparisler");
    revalidatePath("/yonetim/faturalar");
    revalidatePath("/yonetim/aktivite");
    return result;
  } catch (error) {
    log.error("approve order failed", { error });
    return { success: false, error: "Sipariş onaylanırken bir hata oluştu" };
  }
}

export async function rejectOrder(id: string, reason: string) {
  const session = await requirePermission("orders.manage");

  try {
    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return { success: false, error: "Sipariş bulunamadı" };
    }

    if (order.status !== "PENDING") {
      return { success: false, error: "Sadece bekleyen siparişler reddedilebilir" };
    }

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });
      await tx.orderActivity.create({
        data: {
          orderId: id,
          action: "REJECTED",
          description: `Sipariş reddedildi: ${reason}`,
          performedBy: session.user.id,
        },
      });
      await emitEvent(
        tx,
        "order.cancelled",
        { orderId: id, orderNumber: order.orderNumber, customerId: order.customerId, reason },
        { actorId: session.user.id }
      );
    });

    revalidatePath("/yonetim/siparisler");
    return { success: true };
  } catch (error) {
    log.error("reject order failed", { error });
    return { success: false, error: "Sipariş reddedilirken bir hata oluştu" };
  }
}

export async function cancelOrder(id: string, reason: string) {
  const session = await requirePermission("orders.manage");

  try {
    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return { success: false, error: "Sipariş bulunamadı" };
    }

    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      return { success: false, error: "Bu sipariş iptal edilemez" };
    }

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });
      await tx.orderActivity.create({
        data: {
          orderId: id,
          action: "CANCELLED",
          description: `Sipariş iptal edildi: ${reason}`,
          performedBy: session.user.id,
        },
      });
      await emitEvent(
        tx,
        "order.cancelled",
        { orderId: id, orderNumber: order.orderNumber, customerId: order.customerId, reason },
        { actorId: session.user.id }
      );
    });

    revalidatePath("/yonetim/siparisler");
    return { success: true };
  } catch (error) {
    log.error("cancel order failed", { error });
    return { success: false, error: "Sipariş iptal edilirken bir hata oluştu" };
  }
}

export async function completeOrder(id: string) {
  const session = await requirePermission("orders.manage");

  try {
    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return { success: false, error: "Sipariş bulunamadı" };
    }

    if (order.status !== "APPROVED" && order.status !== "PROCESSING") {
      return { success: false, error: "Sadece onaylanmış veya işlenen siparişler tamamlanabilir" };
    }

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      // Local records + queued provisioning job; the registrar / WHM call
      // runs after commit in the provisioning.run job.
      const provisioned = await prepareOrderProvisioning(tx, id);

      await tx.orderActivity.create({
        data: {
          orderId: id,
          action: "COMPLETED",
          description:
            provisioned.status === "NEEDS_ACTION"
              ? `Sipariş tamamlandı; kurulum için müdahale gerekli (${provisioned.error})`
              : provisioned.type === "domain"
                ? "Sipariş tamamlandı; domain kaydı kuyruğa alındı"
                : "Sipariş tamamlandı; hizmet kurulumu kuyruğa alındı",
          performedBy: session.user.id,
          metadata: provisioned,
        },
      });
    });

    revalidatePath("/yonetim/siparisler");
    revalidatePath("/yonetim/hizmetler");
    revalidatePath("/yonetim/musteriler");
    revalidatePath("/musteri/panel/hizmetlerim");
    revalidatePath("/musteri/panel/domainler");
    return { success: true };
  } catch (error) {
    log.error("complete order failed", { error });
    return { success: false, error: "Sipariş tamamlanırken bir hata oluştu" };
  }
}
