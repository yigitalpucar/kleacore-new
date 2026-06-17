import { logActivity } from "@/lib/activity-log";
import { dispatchOutboundWebhook } from "@/lib/integrations/webhooks/outbound";
import type { KleacoreEvent } from "./types";

export interface DispatchEventOptions {
  userId: string;
}

function getEventEntity(event: KleacoreEvent) {
  switch (event.type) {
    case "payment.completed":
      return { entity: "Invoice", entityId: event.payload.invoiceId };
    case "order.paid":
      return { entity: "Order", entityId: event.payload.orderId };
    case "service.renewed":
      return { entity: "Service", entityId: event.payload.serviceId };
  }
}

export async function dispatchEvent(
  event: KleacoreEvent,
  options: DispatchEventOptions
) {
  try {
    await dispatchOutboundWebhook(event.type, event.payload);
  } catch (error) {
    console.error(`[EventDispatcher] Outbound webhook failed for ${event.type}:`, error);
  }

  try {
    const { entity, entityId } = getEventEntity(event);

    await logActivity({
      userId: options.userId,
      action: event.type,
      entity,
      entityId,
      details: event.payload,
    });
  } catch (error) {
    console.error(`[EventDispatcher] Activity log failed for ${event.type}:`, error);
  }
}

export function dispatchEvents(events: KleacoreEvent[], options: DispatchEventOptions) {
  if (events.length === 0) {
    return;
  }

  void (async () => {
    for (const event of events) {
      await dispatchEvent(event, options);
    }
  })();
}