import { db } from "@/lib/db";
import { runServiceBackup } from "@/lib/integrations/backups";
import type { CronJobResult } from "./types";

function computeNextRunAt(frequency: string, from: Date) {
  const next = new Date(from);
  if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

async function enforceRetention(scheduleId: string, retention: number) {
  if (retention <= 0) {
    return 0;
  }

  const backups = await db.backup.findMany({
    where: {
      scheduleId,
      status: "COMPLETED",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const staleIds = backups.slice(retention).map((backup) => backup.id);
  if (staleIds.length === 0) {
    return 0;
  }

  await db.backup.deleteMany({
    where: { id: { in: staleIds } },
  });

  return staleIds.length;
}

export async function runScheduledBackups(): Promise<CronJobResult> {
  const now = new Date();

  const schedules = await db.backupSchedule.findMany({
    where: {
      isActive: true,
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
    },
    orderBy: { nextRunAt: "asc" },
  });

  if (schedules.length === 0) {
    return { processed: 0, ids: [] };
  }

  const processedIds: string[] = [];
  let skipped = 0;

  for (const schedule of schedules) {
    const result = await runServiceBackup(schedule.serviceId, {
      scheduleId: schedule.id,
      type: "FULL",
    });

    const nextRunAt = computeNextRunAt(schedule.frequency, now);

    await db.backupSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: now,
        nextRunAt,
      },
    });

    await enforceRetention(schedule.id, schedule.retention);

    if (result.ok) {
      processedIds.push(schedule.id);
    } else if (result.skipped) {
      skipped += 1;
    } else {
      processedIds.push(schedule.id);
    }
  }

  return {
    processed: processedIds.length,
    skipped,
    ids: processedIds,
  };
}