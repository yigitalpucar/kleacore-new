/**
 * Order approval ("Onayla": PENDING → APPROVED + invoice), shared by the admin
 * server action (src/lib/actions/admin/orders.ts) and the admin API
 * (/api/admin/v1/orders/{id}/approve). The caller checks orders.manage.
 */
import { db } from "@/lib/db";
import { generateInvoiceNumber } from "@/lib/utils/number-generators";
import { logActivity } from "@/lib/activity-log";
import { sub } from "@/lib/money";
import { netInvoiceLine, netInvoiceLineFromOrder } from "@/lib/billing/invoice-lines";

export type ApproveOrderResult =
  | { success: true; data: { orderId: string; invoiceId: string } }
  | { success: false; error: string; status: number };

export async function approveOrderAs(actorId: string, id: string): Promise<ApproveOrderResult> {
  const order = await db.order.findUnique({
    where: { id },
    include: { product: true, items: true },
  });

  if (!order) {
    return { success: false, error: "Sipariş bulunamadı", status: 404 };
  }

  if (order.status !== "PENDING") {
    return { success: false, error: "Sadece bekleyen siparişler onaylanabilir", status: 409 };
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
        approvedBy: actorId,
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
        performedBy: actorId,
      },
    }),
  ]);

  await logActivity({
    userId: actorId,
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

  return {
    success: true,
    data: { orderId: updatedOrder.id, invoiceId: invoice.id },
  };
}
