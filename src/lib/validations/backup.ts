import { z } from "zod";

export const backupTriggerSchema = z.object({
  serviceId: z.string().min(1, "Hizmet ID gerekli"),
});

export const backupIdSchema = z.object({
  backupId: z.string().min(1, "Yedek ID gerekli"),
});

export const backupScheduleToggleSchema = z.object({
  scheduleId: z.string().min(1, "Zamanlama ID gerekli"),
});

export type BackupTriggerInput = z.infer<typeof backupTriggerSchema>;
export type BackupIdInput = z.infer<typeof backupIdSchema>;
export type BackupScheduleToggleInput = z.infer<typeof backupScheduleToggleSchema>;
