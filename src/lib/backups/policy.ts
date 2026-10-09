/**
 * Pure rules of VDS backups (no I/O): slots, retention pruning, schedule
 * slots and the final-backup gate before termination. Unit-tested in
 * policy.test.ts; the DB/queue side lives in ./vds.ts.
 */

export type BackupTriggerValue = "MANUAL" | "SCHEDULED" | "FINAL";
export type BackupStatusValue = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export const BACKUP_FREQUENCIES = ["daily", "weekly"] as const;
export type BackupFrequency = (typeof BACKUP_FREQUENCIES)[number];

/** Backups that occupy a slot: not final, not deleted, not failed. */
export function occupiesSlot(row: { trigger: BackupTriggerValue; status: BackupStatusValue; deletedAt: Date | null }) {
  return row.trigger !== "FINAL" && row.deletedAt === null && row.status !== "FAILED";
}

/** Slots of a VDS: the product's (or the instance default) + extra slots the admin granted. */
export function backupQuota(input: { productSlots?: number | null; instanceDefault: number; extraSlots?: number | null }) {
  const included = Math.max(0, input.productSlots ?? input.instanceDefault);
  const extra = Math.max(0, Math.trunc(input.extraSlots ?? 0));
  return { included, extra, total: included + extra };
}

/**
 * Keep-last-N retention: completed, not-deleted, non-final archives beyond
 * the newest `quota` are pruned (oldest first). Final backups have their own
 * expiry and are never pruned here.
 */
export function selectBackupsToPrune<
  T extends { id: string; trigger: BackupTriggerValue; status: BackupStatusValue; deletedAt: Date | null; completedAt: Date | null; createdAt: Date },
>(rows: T[], quota: number): T[] {
  const kept = rows
    .filter((row) => row.trigger !== "FINAL" && row.status === "COMPLETED" && row.deletedAt === null)
    .sort((a, b) => (b.completedAt ?? b.createdAt).getTime() - (a.completedAt ?? a.createdAt).getTime());
  return kept.slice(Math.max(0, quota)).reverse();
}

/**
 * May a new backup start? MANUAL needs a free slot; SCHEDULED may rotate the
 * oldest completed backup out (pruned after it succeeds) as long as there is
 * at least one to rotate.
 */
export function canStartBackup(
  trigger: Exclude<BackupTriggerValue, "FINAL">,
  rows: Array<{ trigger: BackupTriggerValue; status: BackupStatusValue; deletedAt: Date | null }>,
  quota: number
): { ok: true } | { ok: false; reason: "NO_BACKUPS" | "QUOTA_FULL" | "IN_PROGRESS" } {
  if (quota <= 0) return { ok: false, reason: "NO_BACKUPS" };
  const live = rows.filter((row) => row.trigger !== "FINAL" && row.deletedAt === null);
  if (live.some((row) => row.status === "SCHEDULED" || row.status === "IN_PROGRESS")) return { ok: false, reason: "IN_PROGRESS" };
  const used = live.filter((row) => row.status === "COMPLETED").length;
  if (used < quota) return { ok: true };
  if (trigger === "SCHEDULED" && used > 0) return { ok: true };
  return { ok: false, reason: "QUOTA_FULL" };
}

// ---------------------------------------------------------------------------
// Schedule slots (wall clock in CRON_TIMEZONE)
// ---------------------------------------------------------------------------

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: weekdays.indexOf(get("weekday")),
  };
}

/** UTC instant of a wall-clock time in `timeZone` (fixed or DST zones). */
export function zonedTimeToUtc(
  wall: { year: number; month: number; day: number; hour: number; minute?: number },
  timeZone: string
): Date {
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute ?? 0);
  // Offset of the zone at the guessed instant, applied twice to settle around DST changes.
  let utc = guess;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(utc), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    utc = guess - (asUtc - utc);
  }
  return new Date(utc);
}

/**
 * Next run of a schedule strictly after `from`: at `hour`:00 local time,
 * every day or on `weekday` (0 = Sunday) for weekly schedules.
 */
export function nextScheduledRun(
  schedule: { frequency: string; hour: number; weekday: number | null },
  from: Date,
  timeZone: string
): Date {
  const hour = Math.min(23, Math.max(0, Math.trunc(schedule.hour)));
  const weekly = schedule.frequency === "weekly";
  const weekday = weekly ? Math.min(6, Math.max(0, Math.trunc(schedule.weekday ?? 0))) : null;
  const local = zonedParts(from, timeZone);
  for (let offset = 0; offset <= 8; offset++) {
    // Calendar arithmetic on the local date (UTC-based Date as a plain calendar).
    const day = new Date(Date.UTC(local.year, local.month - 1, local.day + offset));
    if (weekday !== null && day.getUTCDay() !== weekday) continue;
    const candidate = zonedTimeToUtc(
      { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate(), hour },
      timeZone
    );
    if (candidate.getTime() > from.getTime()) return candidate;
  }
  // Unreachable for valid input; fall back to a day later.
  return new Date(from.getTime() + 24 * 60 * 60 * 1000);
}

/** Idempotency key of one schedule run: a slot is backed up at most once. */
export function scheduleSlotKey(scheduleId: string, slot: Date) {
  return `${scheduleId}:${slot.toISOString()}`;
}

// ---------------------------------------------------------------------------
// Termination
// ---------------------------------------------------------------------------

export type FinalBackupDecision =
  /** Destroy now: a final backup completed, or the admin explicitly skipped it. */
  | { action: "destroy"; reason: "COMPLETED" | "SKIPPED" }
  /** A final backup is queued or running: wait for it. */
  | { action: "wait"; backupId: string }
  /** No usable final backup (none yet, or the last one failed): take one first. */
  | { action: "backup"; previousFailed: boolean };

/**
 * Before a VDS is destroyed on termination: never without a completed final
 * backup unless the admin explicitly skipped it.
 */
export function decideFinalBackup(
  finalBackups: Array<{ id: string; status: BackupStatusValue; deletedAt: Date | null; createdAt: Date }>,
  options: { skipFinalBackup?: boolean } = {}
): FinalBackupDecision {
  if (options.skipFinalBackup) return { action: "destroy", reason: "SKIPPED" };
  const live = finalBackups.filter((row) => row.deletedAt === null).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (live.some((row) => row.status === "COMPLETED")) return { action: "destroy", reason: "COMPLETED" };
  const running = live.find((row) => row.status === "SCHEDULED" || row.status === "IN_PROGRESS");
  if (running) return { action: "wait", backupId: running.id };
  return { action: "backup", previousFailed: live.some((row) => row.status === "FAILED") };
}

/** "…_RUNNING:" errors mean the remote task is still going (resume later), not a failure. */
export function isStillRunning(error: string | undefined | null) {
  return /^[A-Z_]+_RUNNING:/.test(error ?? "");
}

export function bytesToMB(bytes: number | null | undefined) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return null;
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}
