"use server";

import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { generateInvoiceNumber } from "@/lib/utils/number-generators";
import { prepareOrderProvisioning } from "@/lib/provisioning/internal";
import { logActivity } from "@/lib/activity-log";
import { revalidatePath } from "next/cache";
import { createLogger } from "@/lib/logger";
import { sub } from "@/lib/money";
import { netInvoiceLine, netInvoiceLineFromOrder } from "@/lib/billing/invoice-lines";

const log = createLogger("admin.orders");

export async function approveOrder(id: string) {
  const session = await requirePermission("orders.manage");

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

    const invoiceNumber = await generateInvoiceNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const subtotal = sub(order.totalAmount, order.taxAmount);
    const description = order.items[0]?.productName ?? order.product.name;
    const orderLine = netInvoiceLineFromOrder(order, description);
    // The invoice must equal its lines; an order whose net amounts don't add
    // up (legacy rows) is billed as one net line of its subtotal.
    const invoiceLine = orderLine.totalPrice.equals(subtotal)
      ? orderLine
      : netInvoiceLine({ description, unitPrice: subtotal });

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
            // Net line from the order's own net amounts (OrderItem is net too
            // since 20261009130000_order_item_net; legacy rows may not be).
            create: invoiceLine,
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

    if (order.provisioningHeldAt) {
      // Fraud review / KYC hold: released from the review queue or the KYC page.
      return { success: false, error: "Sipariş inceleme veya kimlik doğrulaması bekliyor; önce onu tamamlayın" };
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
