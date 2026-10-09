import { describe, expect, it } from "vitest";
import {
  backupQuota,
  canStartBackup,
  decideFinalBackup,
  isStillRunning,
  nextScheduledRun,
  scheduleSlotKey,
  selectBackupsToPrune,
  zonedTimeToUtc,
  type BackupStatusValue,
  type BackupTriggerValue,
} from "./policy";

const TZ = "Europe/Istanbul";

function row(id: string, day: number, overrides: Partial<{ trigger: BackupTriggerValue; status: BackupStatusValue; deletedAt: Date | null }> = {}) {
  const at = new Date(Date.UTC(2026, 9, day, 3));
  return {
    id,
    trigger: "SCHEDULED" as BackupTriggerValue,
    status: "COMPLETED" as BackupStatusValue,
    deletedAt: null as Date | null,
    createdAt: at,
    completedAt: at,
    ...overrides,
  };
}

describe("backup slots", () => {
  it("uses the product's slots, else the instance default, plus admin extra slots", () => {
    expect(backupQuota({ productSlots: 3, instanceDefault: 2, extraSlots: 2 })).toEqual({ included: 3, extra: 2, total: 5 });
    expect(backupQuota({ productSlots: undefined, instanceDefault: 2 })).toEqual({ included: 2, extra: 0, total: 2 });
    expect(backupQuota({ productSlots: 0, instanceDefault: 2 })).toEqual({ included: 0, extra: 0, total: 0 });
  });

  it("manual backups need a free slot; scheduled ones may rotate the oldest", () => {
    const full = [row("a", 1), row("b", 2)];
    expect(canStartBackup("MANUAL", full, 2)).toEqual({ ok: false, reason: "QUOTA_FULL" });
    expect(canStartBackup("SCHEDULED", full, 2)).toEqual({ ok: true });
    expect(canStartBackup("MANUAL", [row("a", 1)], 2)).toEqual({ ok: true });
  });

  it("refuses while a backup is queued or running, and without slots", () => {
    expect(canStartBackup("MANUAL", [row("a", 1, { status: "IN_PROGRESS" })], 3)).toEqual({ ok: false, reason: "IN_PROGRESS" });
    expect(canStartBackup("SCHEDULED", [row("a", 1, { status: "SCHEDULED" })], 3)).toEqual({ ok: false, reason: "IN_PROGRESS" });
    expect(canStartBackup("MANUAL", [], 0)).toEqual({ ok: false, reason: "NO_BACKUPS" });
  });

  it("final, deleted and failed backups occupy no slot", () => {
    const rows = [
      row("final", 1, { trigger: "FINAL" }),
      row("deleted", 2, { deletedAt: new Date() }),
      row("failed", 3, { status: "FAILED" }),
      row("ok", 4),
    ];
    expect(canStartBackup("MANUAL", rows, 2)).toEqual({ ok: true });
  });
});

describe("retention pruning (keep last N)", () => {
  it("prunes the oldest completed backups beyond the quota", () => {
    const rows = [row("d1", 1), row("d2", 2, { trigger: "MANUAL" }), row("d3", 3), row("d4", 4)];
    expect(selectBackupsToPrune(rows, 2).map((r) => r.id)).toEqual(["d1", "d2"]);
    expect(selectBackupsToPrune(rows, 4)).toEqual([]);
  });

  it("never prunes final, deleted, failed or running backups", () => {
    const rows = [
      row("final", 1, { trigger: "FINAL" }),
      row("deleted", 2, { deletedAt: new Date() }),
      row("failed", 3, { status: "FAILED" }),
      row("running", 4, { status: "IN_PROGRESS" }),
      row("k1", 5),
      row("k2", 6),
    ];
    expect(selectBackupsToPrune(rows, 1).map((r) => r.id)).toEqual(["k1"]);
  });
});

describe("schedule slots (Europe/Istanbul wall clock)", () => {
  it("converts a local wall-clock hour to UTC", () => {
    expect(zonedTimeToUtc({ year: 2026, month: 10, day: 9, hour: 3 }, TZ).toISOString()).toBe("2026-10-09T00:00:00.000Z");
  });

  it("daily: today's window if still ahead, else tomorrow's", () => {
    const schedule = { frequency: "daily", hour: 3, weekday: null };
    // 02:30 local → 03:00 local today.
    expect(nextScheduledRun(schedule, new Date("2026-10-08T23:30:00Z"), TZ).toISOString()).toBe("2026-10-09T00:00:00.000Z");
    // exactly at the slot → strictly after: tomorrow.
    expect(nextScheduledRun(schedule, new Date("2026-10-09T00:00:00Z"), TZ).toISOString()).toBe("2026-10-10T00:00:00.000Z");
  });

  it("weekly: next matching weekday", () => {
    // 2026-10-09 is a Friday; weekday 1 = Monday → 2026-10-12 23:00 local = 20:00Z.
    const next = nextScheduledRun({ frequency: "weekly", hour: 23, weekday: 1 }, new Date("2026-10-09T12:00:00Z"), TZ);
    expect(next.toISOString()).toBe("2026-10-12T20:00:00.000Z");
  });

  it("handles a DST zone", () => {
    // Europe/Berlin switches to CET on 2026-10-25: 03:00 local = 02:00Z afterwards.
    const next = nextScheduledRun({ frequency: "daily", hour: 3, weekday: null }, new Date("2026-10-25T00:30:00Z"), "Europe/Berlin");
    expect(next.toISOString()).toBe("2026-10-25T02:00:00.000Z");
  });

  it("one idempotency key per schedule slot", () => {
    const slot = new Date("2026-10-09T00:00:00Z");
    expect(scheduleSlotKey("sch_1", slot)).toBe("sch_1:2026-10-09T00:00:00.000Z");
    expect(scheduleSlotKey("sch_1", new Date(slot))).toBe(scheduleSlotKey("sch_1", slot));
  });
});

describe("final backup gate", () => {
  const final = (id: string, status: BackupStatusValue, minutes = 0, deletedAt: Date | null = null) => ({
    id,
    status,
    deletedAt,
    createdAt: new Date(Date.UTC(2026, 9, 9, 3, minutes)),
  });

  it("starts a final backup when there is none", () => {
    expect(decideFinalBackup([])).toEqual({ action: "backup", previousFailed: false });
  });

  it("waits while one is queued or running", () => {
    expect(decideFinalBackup([final("f1", "IN_PROGRESS")])).toEqual({ action: "wait", backupId: "f1" });
    expect(decideFinalBackup([final("f1", "SCHEDULED")])).toEqual({ action: "wait", backupId: "f1" });
  });

  it("destroys only after a completed final backup", () => {
    expect(decideFinalBackup([final("f1", "FAILED"), final("f2", "COMPLETED", 5)])).toEqual({ action: "destroy", reason: "COMPLETED" });
  });

  it("a failed final backup never lets the VM be destroyed: it is taken again", () => {
    expect(decideFinalBackup([final("f1", "FAILED")])).toEqual({ action: "backup", previousFailed: true });
    // A completed-but-deleted archive does not count either.
    expect(decideFinalBackup([final("f1", "COMPLETED", 0, new Date())])).toEqual({ action: "backup", previousFailed: false });
  });

  it("only the admin's explicit skip destroys without one", () => {
    expect(decideFinalBackup([final("f1", "FAILED")], { skipFinalBackup: true })).toEqual({ action: "destroy", reason: "SKIPPED" });
  });

  it("recognises still-running task errors", () => {
    expect(isStillRunning("PROXMOX_BACKUP_RUNNING: Proxmox görevi 60 sn içinde bitmedi")).toBe(true);
    expect(isStillRunning("PROXMOX_BACKUP: no space left")).toBe(false);
  });
});
