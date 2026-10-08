"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { createLogger } from "@/lib/logger";
import { saveReminderSchedule } from "@/lib/notifications/reminder-schedule";
import { requirePermission } from "@/lib/utils/auth-helpers";

const log = createLogger("admin.reminder-schedule");

export async function saveReminderScheduleAction(input: unknown) {
  const session = await requirePermission("settings.manage");
  try {
    const result = await saveReminderSchedule(input);
    if (!result.ok) {
      return {
        success: false as const,
        error: result.issues.map((issue) => issue.message).join(" ") || "Takvim geçersiz",
      };
    }
    await logActivity({
      userId: session.user.id,
      action: "REMINDER_SCHEDULE_SAVE",
      entity: "Setting",
      entityId: "invoice_reminder_schedule",
      details: result.schedule,
    });
    revalidatePath("/yonetim/bildirimler/hatirlatmalar");
    return { success: true as const };
  } catch (error) {
    log.error("reminder schedule save failed", { error });
    return { success: false as const, error: "Takvim kaydedilemedi" };
  }
}
