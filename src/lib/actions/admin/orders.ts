"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { generateInvoiceNumber } from "@/lib/utils/number-generators";
import { provisionCompletedOrder } from "@/lib/provisioning/internal";
import { logActivity } from "@/lib/activity-log";
import { revalidatePath } from "next/cache";

export async function approveOrder(id: string) {
  const session = await requireAdmin();

  try {
    const order = await db.order.findUnique({
      where: { id },
      include: { product: true, items: true },
    });

    if (!order) {
      return { success: false, error: "Sipariş bulunamadı" };
    }

    if (order.status !== "PENDING") {
      return { success: false, error: "Sadece bekleyen siparişler onaylanabilir" };
    }

    const invoiceNumber = generateInvoiceNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const subtotal = order.totalAmount - order.taxAmount;

    const [updatedOrder, invoice] = await db.$transaction([
      db.order.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedBy: session.user.id,
        },
      }),
      db.invoice.create({
        data: {
          invoiceNumber,
          customerId: order.customerId,
          orderId: order.id,
          subtotal,
          taxRate: order.taxRate,
          taxAmount: order.taxAmount,
          totalAmount: order.totalAmount,
          status: "PENDING",
          dueDate,
          items: {
            create: order.items.map((item) => ({
              description: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
      }),
      db.orderActivity.create({
        data: {
          orderId: id,
          action: "APPROVED",
          description: "Sipariş onaylandı ve fatura oluşturuldu",
          performedBy: session.user.id,
        },
      }),
    ]);

    await logActivity({
      userId: session.user.id,
      action: "ORDER_STATUS_CHANGE",
      entity: "Order",
      entityId: id,
      details: {
        orderNumber: order.orderNumber,
        previousStatus: "PENDING",
        newStatus: "APPROVED",
        invoiceId: invoice.id,
        invoiceNumber,
      },
    });

    revalidatePath("/yonetim/siparisler");
    revalidatePath("/yonetim/faturalar");
    revalidatePath("/yonetim/aktivite");
    return {
      success: true,
      data: { orderId: updatedOrder.id, invoiceId: invoice.id },
    };
  } catch {
    return { success: false, error: "Sipariş onaylanırken bir hata oluştu" };
  }
}

export async function rejectOrder(id: string, reason: string) {
  const session = await requireAdmin();

  try {
    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return { success: false, error: "Sipariş bulunamadı" };
    }

    if (order.status !== "PENDING") {
      return { success: false, error: "Sadece bekleyen siparişler reddedilebilir" };
    }

    await db.$transaction([
      db.order.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      }),
      db.orderActivity.create({
        data: {
          orderId: id,
          action: "REJECTED",
          description: `Sipariş reddedildi: ${reason}`,
          performedBy: session.user.id,
        },
      }),
    ]);

    revalidatePath("/yonetim/siparisler");
    return { success: true };
  } catch {
    return { success: false, error: "Sipariş reddedilirken bir hata oluştu" };
  }
}

export async function cancelOrder(id: string, reason: string) {
  const session = await requireAdmin();

  try {
    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return { success: false, error: "Sipariş bulunamadı" };
    }

    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      return { success: false, error: "Bu sipariş iptal edilemez" };
    }

    await db.$transaction([
      db.order.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      }),
      db.orderActivity.create({
        data: {
          orderId: id,
          action: "CANCELLED",
          description: `Sipariş iptal edildi: ${reason}`,
          performedBy: session.user.id,
        },
      }),
    ]);

    revalidatePath("/yonetim/siparisler");
    return { success: true };
  } catch {
    return { success: false, error: "Sipariş iptal edilirken bir hata oluştu" };
  }
}

export async function completeOrder(id: string) {
  const session = await requireAdmin();

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

      const provisioned = await provisionCompletedOrder(tx, id);

      await tx.orderActivity.create({
        data: {
          orderId: id,
          action: "COMPLETED",
          description:
            provisioned.type === "domain"
              ? "Sipariş tamamlandı ve domain kaydı aktifleştirildi"
              : "Sipariş tamamlandı ve hizmet aktifleştirildi",
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
  } catch {
    return { success: false, error: "Sipariş tamamlanırken bir hata oluştu" };
  }
}
