import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { EventType } from "../catalog";
import type { EventSubscriber } from "./types";

/**
 * Events recorded in the admin activity log (/yonetim/aktivite). The payment
 * events were logged by the old in-process dispatcher; the others have no
 * explicit logActivity call at their source. Events whose source already
 * writes its own activity row (refunds, domain renew, admin actions) are not
 * listed, so nothing is logged twice.
 */
export const ACTIVITY_LOGGED_EVENTS: readonly EventType[] = [
  "invoice.paid",
  "order.paid",
  "service.renewed",
  "payment.failed",
  "service.provisioning_failed",
  "user.login_failed_locked",
];

function actorFor(payload: Record<string, unknown>, actorId: string | null) {
  if (actorId) return actorId;
  for (const key of ["customerId", "userId"]) {
    const value = payload[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

export const activityLogSubscriber: EventSubscriber = {
  name: "activity-log",
  label: "Aktivite kaydı",
  handles: (type) => ACTIVITY_LOGGED_EVENTS.includes(type),
  async handle(event) {
    const userId = actorFor(event.payload as Record<string, unknown>, event.actorId);
    if (!userId) return { skipped: "NO_ACTOR" };

    // Idempotent per event: a retried delivery finds its own row.
    const existing = await db.activityLog.findFirst({
      where: { action: event.type, entityId: event.aggregateId, details: { path: ["eventId"], equals: event.id } },
      select: { id: true },
    });
    if (existing) return { activityLogId: existing.id, existing: true };

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return { skipped: "ACTOR_NOT_FOUND" };

    const row = await db.activityLog.create({
      data: {
        userId,
        action: event.type,
        entity: event.aggregateType,
        entityId: event.aggregateId,
        details: { ...(event.payload as Record<string, unknown>), eventId: event.id } as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return { activityLogId: row.id };
  },
};
