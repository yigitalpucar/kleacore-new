"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { redeliverEvent } from "@/lib/events/dispatch";
import { getSubscriber } from "@/lib/events/subscribers";
import { createLogger } from "@/lib/logger";
import { requireAdmin } from "@/lib/utils/auth-helpers";

const log = createLogger("admin.events");

/**
 * "Yeniden dağıt": re-queues an outbox event. Without a subscriber only the
 * failed/pending deliveries run again; with one, that subscriber runs again
 * even if it delivered (notification dedupe keys still prevent a second mail).
 */
export async function redeliverEventAction(eventId: string, subscriber?: string) {
  const session = await requireAdmin();
  if (subscriber && !getSubscriber(subscriber)) {
    return { success: false as const, error: "Bilinmeyen abone" };
  }

  try {
    const result = await redeliverEvent(eventId, subscriber);
    await logActivity({
      userId: session.user.id,
      action: "EVENT_REDELIVER",
      entity: "DomainEvent",
      entityId: eventId,
      details: { subscriber: subscriber ?? null, queued: result.queued },
    });
    revalidatePath("/yonetim/olaylar");
    revalidatePath(`/yonetim/olaylar/${eventId}`);
    return { success: true as const, queued: result.queued };
  } catch (error) {
    log.error("event redeliver failed", { eventId, subscriber, error });
    return {
      success: false as const,
      error: error instanceof Error && error.message === "EVENT_NOT_FOUND" ? "Olay bulunamadı" : "Olay yeniden dağıtılamadı",
    };
  }
}
