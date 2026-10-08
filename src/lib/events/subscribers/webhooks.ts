import type { KleacoreEvent } from "../types";
import type { DispatchedEvent, EventSubscriber } from "./types";
import { isEvent } from "./types";

/**
 * Maps catalogue events onto the legacy outbound webhook contract
 * (src/lib/events/types.ts) so existing receivers keep getting the same
 * type names and payloads. Delivery is at-least-once: a receiver timeout is
 * retried, so receivers must tolerate a repeated body (same payload).
 */
export function toLegacyWebhook(event: DispatchedEvent): KleacoreEvent | null {
  if (isEvent(event, "invoice.paid")) {
    const p = event.payload;
    return {
      type: "payment.completed",
      payload: {
        invoiceId: p.invoiceId,
        invoiceNumber: p.invoiceNumber,
        customerId: p.customerId,
        amount: Number(p.amount),
        ...(p.paymentReference ? { paymentReference: p.paymentReference } : {}),
        context: p.context,
      },
    };
  }
  if (isEvent(event, "order.paid")) {
    const p = event.payload;
    return {
      type: "order.paid",
      payload: { orderId: p.orderId, orderNumber: p.orderNumber, customerId: p.customerId, totalAmount: Number(p.totalAmount) },
    };
  }
  if (isEvent(event, "service.renewed")) {
    const p = event.payload;
    return {
      type: "service.renewed",
      payload: { serviceId: p.serviceId, customerId: p.customerId, newExpiryDate: p.newExpiryDate, renewalMonths: p.renewalMonths },
    };
  }
  return null;
}

export const webhooksSubscriber: EventSubscriber = {
  name: "webhooks",
  label: "Giden webhook",
  handles: (type) => type === "invoice.paid" || type === "order.paid" || type === "service.renewed",
  async handle(event) {
    const legacy = toLegacyWebhook(event);
    if (!legacy) return { skipped: "UNSUPPORTED_EVENT" };
    const { dispatchOutboundWebhook } = await import("@/lib/integrations/webhooks/outbound");
    const result = await dispatchOutboundWebhook(legacy.type, legacy.payload as never);
    if (!result.sent) return { skipped: result.skipped };
    return { webhookType: legacy.type, status: result.status };
  },
};
