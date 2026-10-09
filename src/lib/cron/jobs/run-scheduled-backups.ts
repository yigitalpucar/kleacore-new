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

/**
 * Hourly (`run-backups`): due schedules, then VDS housekeeping (lost jobs
 * re-queued, expired final backups deleted). VDS schedules (module with the
 * "backups" capability) go through src/lib/backups/vds.ts: per-slot
 * idempotent, queued per Proxmox node, pruned after success. Others keep the
 * legacy provider path (cPanel) below.
 */
export async function runScheduledBackups(): Promise<CronJobResult & { vds?: Record<string, number>; maintenance?: unknown }> {
  const now = new Date();
  const { isVdsBackupService, runVdsBackupMaintenance, runVdsSchedule } = await import("@/lib/backups/vds");

  const schedules = await db.backupSchedule.findMany({
    where: {
      isActive: true,
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
    },
    orderBy: { nextRunAt: "asc" },
  });

  const processedIds: string[] = [];
  let skipped = 0;
  const vds: Record<string, number> = {};

  for (const schedule of schedules) {
    if (await isVdsBackupService(schedule.serviceId)) {
      const outcome = await runVdsSchedule(schedule, now);
      vds[outcome] = (vds[outcome] ?? 0) + 1;
      if (outcome === "queued") processedIds.push(schedule.id);
      else skipped += 1;
      continue;
    }

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

  const maintenance = await runVdsBackupMaintenance(now);

  return {
    processed: processedIds.length,
    skipped,
    ids: processedIds,
    vds,
    maintenance,
  };
}