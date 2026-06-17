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

export async function dispatchOutboundWebhook<T extends KleacoreEventType>(
  eventType: T,
  payload: KleacoreEventPayload<T>
) {
  try {
    const settings = await getSettingMap([
      { key: "webhook_orders" },
      { key: "webhook_payments" },
    ]);

    const url = resolveWebhookUrl(eventType, settings);
    if (!url) {
      return;
    }

    const body = JSON.stringify({
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
    });
    const secret = getSigningSecret();
    if (!secret) {
      console.error(
        `[OutboundWebhook] ${eventType} skipped: WEBHOOK_SIGNING_SECRET is not configured`
      );
      return;
    }

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
        console.error(
          `[OutboundWebhook] ${eventType} failed with HTTP ${response.status}`
        );
      }
    } catch (error) {
      console.error(`[OutboundWebhook] ${eventType} request failed:`, error);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error(`[OutboundWebhook] ${eventType} dispatch failed:`, error);
  }
}