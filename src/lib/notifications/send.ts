/**
 * STUB — owned by the notify agent, who replaces this file with the real
 * template/NotificationLog implementation. Agreed signature:
 * `sendNotification({ userId, template, data, channel? })`, enqueuing a
 * "notification.send" job. Until the job is registered in the queue this
 * stub only logs, so callers never fail because of a notification.
 */
import { createLogger } from "@/lib/logger";

const log = createLogger("notifications.send");

export type NotificationChannel = "EMAIL" | "SMS";

export interface SendNotificationInput {
  userId: string;
  /** Template key, e.g. "bank_transfer.rejected". */
  template: string;
  data: Record<string, unknown>;
  channel?: NotificationChannel;
}

export async function sendNotification(input: SendNotificationInput): Promise<void> {
  try {
    const [{ enqueue }, { jobRegistry }] = await Promise.all([
      import("@/lib/jobs/enqueue"),
      import("@/lib/jobs/definitions"),
    ]);
    const known = jobRegistry.all().some((definition) => (definition.name as string) === "notification.send");
    if (!known) {
      log.info("notification.send job not registered yet; notification skipped", {
        template: input.template,
        userId: input.userId,
      });
      return;
    }
    await (enqueue as unknown as (name: string, payload: unknown) => Promise<unknown>)(
      "notification.send",
      input
    );
  } catch (error) {
    log.error("notification enqueue failed", { template: input.template, error });
  }
}
