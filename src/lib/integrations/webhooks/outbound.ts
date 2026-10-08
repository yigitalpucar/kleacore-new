import { createHmac } from "crypto";
import type { KleacoreEventPayload, KleacoreEventType } from "@/lib/events/types";
import { getSettingMap } from "@/lib/integrations/settings";

const WEBHOOK_TIMEOUT_MS = 5000;

function getSigningSecret() {
  return process.env.WEBHOOK_SIGNING_SECRET?.trim() || "";
}

export function createWebhookSignature(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function resolveWebhookUrl(
  eventType: KleacoreEventType,
  settings: Record<string, string>
) {
  if (eventType === "order.paid") {
    return settings.webhook_orders?.trim() ?? "";
  }

  if (eventType === "payment.completed" || eventType === "service.renewed") {
    return settings.webhook_payments?.trim() ?? "";
  }

  return "";
}

export type OutboundWebhookResult =
  | { sent: true; url: string; status: number }
  | { sent: false; skipped: "NO_URL" | "NO_SIGNING_SECRET" };

/**
 * Posts one signed webhook (X-Kleacore-Signature: HMAC-SHA256 of the body).
 * Called by the outbox "webhooks" subscriber; throws on a network error or a
 * non-2xx answer so the event delivery is retried with backoff. Not having a
 * URL or signing secret configured is a skip, not an error.
 */
export async function dispatchOutboundWebhook<T extends KleacoreEventType>(
  eventType: T,
  payload: KleacoreEventPayload<T>
): Promise<OutboundWebhookResult> {
  const settings = await getSettingMap([
    { key: "webhook_orders" },
    { key: "webhook_payments" },
  ]);

  const url = resolveWebhookUrl(eventType, settings);
  if (!url) {
    return { sent: false, skipped: "NO_URL" };
  }

  const secret = getSigningSecret();
  if (!secret) {
    console.error(
      `[OutboundWebhook] ${eventType} skipped: WEBHOOK_SIGNING_SECRET is not configured`
    );
    return { sent: false, skipped: "NO_SIGNING_SECRET" };
  }

  const body = JSON.stringify({
    type: eventType,
    payload,
    timestamp: new Date().toISOString(),
  });
  const signature = createWebhookSignature(body, secret);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Kleacore-Signature": signature,
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`WEBHOOK_HTTP_${response.status}`);
    }
    return { sent: true, url, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}
