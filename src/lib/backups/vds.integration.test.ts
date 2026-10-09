/**
 * VDS backups end to end against a real Postgres and a fake Proxmox (HTTP
 * mocked, src/lib/modules/server/proxmox/fake-pve.ts): backup job, keep-last-N
 * pruning, schedule-slot idempotency, restore, the termination flow (final
 * backup first, refuse to destroy on failure) and final-backup expiry.
 * Jobs are not run by pg-boss: enqueue is captured and handlers are called
 * directly. Skipped unless RUN_DB_TESTS=1 (local/dev database only):
 *
 *   RUN_DB_TESTS=1 pnpm vitest run src/lib/backups/vds.integration.test.ts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const queued = vi.hoisted(() => ({ jobs: [] as Array<{ name: string; payload: Record<string, string>; options: unknown }> }));
vi.mock("@/lib/provisioning/queue", () => ({ isJobQueueReady: async () => true }));
vi.mock("@/lib/jobs/enqueue", () => ({
  enqueue: vi.fn(async (name: string, payload: Record<string, string>, options: unknown) => {
    queued.jobs.push({ name, payload, options });
    return { id: randomUUID(), deduplicated: false };
  }),
}));

import { db } from "@/lib/db";
import { terminateRemoteService } from "@/lib/integrations/provisioning";
import { saveModuleInstance } from "@/lib/modules/instances";
import { ownerMarker, vmNameFor } from "@/lib/modules/server/proxmox";
import { createFakePve } from "@/lib/modules/server/proxmox/fake-pve";
import { restoreFetch } from "@/lib/modules/testing";
import {
  BackupError,
  requestVdsBackup,
  requestVdsRestore,
  runServerTerminateJob,
  runVdsBackupJob,
  runVdsBackupMaintenance,
  runVdsRestoreJob,
  runVdsSchedule,
} from "./vds";

const enabled = process.env.RUN_DB_TESTS === "1";
const job = { isFinalAttempt: false };
const lastAttempt = { isFinalAttempt: true };

describe.runIf(enabled)("VDS backups (integration, real Postgres + fake Proxmox)", () => {
  const tag = `bk-${randomUUID().slice(0, 8)}`;
  let instanceId = "";
  let productId = "";
  let customerId = "";
  const serviceIds: string[] = [];
  let pve: ReturnType<typeof createFakePve>;

  async function createService(vmid: number) {
    const service = await db.service.create({
      data: { customerId, productId, label: `${tag}-${vmid}`, status: "ACTIVE", moduleInstanceId: instanceId, remoteId: String(vmid) },
    });
    serviceIds.push(service.id);
    pve.addVm({
      vmid,
      status: "running",
      config: { name: vmNameFor(service.id), description: `${ownerMarker(service.id)}\nVDS`, net0: "virtio=BC:24:11:00:00:01,bridge=vmbr0" },
    });
    return service;
  }

  beforeAll(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const saved = await saveModuleInstance({
      moduleId: "proxmox",
      label: tag,
      config: {
        apiUrl: "https://pve.test:8006",
        tokenId: "kleacore@pve!kleacore",
        tokenSecret: "pve-secret-0123456789",
        node: "pve",
        taskTimeoutSeconds: 30,
        backupRetention: 2,
        finalBackupKeepDays: 14,
      },
    });
    if (!saved.ok) throw new Error(saved.error);
    instanceId = saved.instance.id;
    const category = await db.productCategory.findFirstOrThrow({ where: { slug: { in: ["vds", "vps", "server"] } }, select: { id: true } });
    productId = (
      await db.product.create({
        data: {
          categoryId: category.id,
          sku: `${tag}-sku`,
          slug: `${tag}-slug`,
          name: `${tag} VDS`,
          moduleInstanceId: instanceId,
          moduleOptions: { templateVmid: 9000 },
        },
      })
    ).id;
    customerId = (await db.user.create({ data: { email: `${tag}@test.local`, name: "Yedek", surname: "Test", password: "x" } })).id;
  });

  beforeEach(() => {
    queued.jobs = [];
    pve = createFakePve();
    pve.taskPolls = 0;
    pve.install();
  });

  afterEach(() => restoreFetch());

  afterAll(async () => {
    await db.domainEvent.deleteMany({ where: { aggregateId: { in: serviceIds } } });
    await db.backup.deleteMany({ where: { serviceId: { in: serviceIds } } });
    await db.backupSchedule.deleteMany({ where: { serviceId: { in: serviceIds } } });
    await db.activityLog.deleteMany({ where: { entityId: { in: serviceIds } } }).catch(() => undefined);
    await db.service.deleteMany({ where: { id: { in: serviceIds } } });
    await db.product.deleteMany({ where: { id: productId } });
    await db.moduleInstance.deleteMany({ where: { id: instanceId } });
    await db.user.deleteMany({ where: { id: customerId } });
  });

  it("runs a backup through the job, then keeps only the last N archives", async () => {
    const service = await createService(1000);

    const first = (await requestVdsBackup(service.id, { trigger: "MANUAL" }))!;
    expect(queued.jobs).toEqual([{ name: "backup.run", payload: { backupId: first.id }, options: { singletonKey: `${instanceId}:pve` } }]);
    // Nothing else may start while it is queued.
    await expect(requestVdsBackup(service.id, { trigger: "MANUAL" })).rejects.toMatchObject({ code: "IN_PROGRESS" });

    await runVdsBackupJob(first.id, job);
    const done = await db.backup.findUniqueOrThrow({ where: { id: first.id } });
    expect(done).toMatchObject({ status: "COMPLETED", trigger: "MANUAL", storage: "local", node: "pve", vmid: 1000, upid: null });
    expect(done.volid).toMatch(/^local:backup\/vzdump-qemu-1000-/);
    expect(done.size).toBeCloseTo(101, 0);
    expect(pve.calls.find((call) => call.path === "/nodes/pve/vzdump")!.params.get("notes-template")).toContain(`kleacore-backup:${first.id}`);

    const second = (await requestVdsBackup(service.id, { trigger: "MANUAL" }))!;
    await runVdsBackupJob(second.id, job);
    // Quota (2) full: manual refused, a scheduled one rotates the oldest out.
    await expect(requestVdsBackup(service.id, { trigger: "MANUAL" })).rejects.toBeInstanceOf(BackupError);
    const third = (await requestVdsBackup(service.id, { trigger: "SCHEDULED" }))!;
    await runVdsBackupJob(third.id, job);

    const rows = await db.backup.findMany({ where: { serviceId: service.id }, orderBy: { createdAt: "asc" } });
    expect(rows.map((row) => [row.id, row.deletedAt !== null])).toEqual([
      [first.id, true],
      [second.id, false],
      [third.id, false],
    ]);
    expect(pve.archives("local").map((archive) => archive.volid)).toEqual([rows[1].volid, rows[2].volid]);
    expect(await db.domainEvent.count({ where: { aggregateId: service.id, type: "backup.completed" } })).toBe(3);
  });

  it("a failed vzdump is retried, and marked FAILED (admin alerted) after the last attempt", async () => {
    const service = await createService(1001);
    const backup = (await requestVdsBackup(service.id, { trigger: "MANUAL" }))!;
    pve.failNextBackup = "ERROR: no space left on device";
    await expect(runVdsBackupJob(backup.id, job)).rejects.toThrow(/no space left/);
    expect(await db.backup.findUniqueOrThrow({ where: { id: backup.id } })).toMatchObject({ status: "IN_PROGRESS", upid: null });

    pve.failNextBackup = "ERROR: no space left on device";
    await runVdsBackupJob(backup.id, lastAttempt);
    expect(await db.backup.findUniqueOrThrow({ where: { id: backup.id } })).toMatchObject({ status: "FAILED" });
    expect(await db.domainEvent.count({ where: { aggregateId: service.id, type: "backup.failed" } })).toBe(1);
  });

  it("a schedule slot is backed up once even when two cron runs overlap", async () => {
    const service = await createService(1002);
    const slot = new Date(Date.now() - 60_000);
    const schedule = await db.backupSchedule.create({
      data: { serviceId: service.id, frequency: "daily", hour: 3, isActive: true, nextRunAt: slot },
    });
    const now = new Date();

    const outcomes = await Promise.all([runVdsSchedule(schedule, now), runVdsSchedule(schedule, now)]);

    expect(outcomes.sort()).toEqual(["claimed-elsewhere", "queued"]);
    const rows = await db.backup.findMany({ where: { serviceId: service.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ trigger: "SCHEDULED", scheduleId: schedule.id, slotKey: `${schedule.id}:${slot.toISOString()}` });
    const updated = await db.backupSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(updated.nextRunAt!.getTime()).toBeGreaterThan(now.getTime());

    // Same slot again (stale schedule snapshot): the unique slot key stops a second backup.
    await runVdsBackupJob(rows[0].id, job);
    expect(await requestVdsBackup(service.id, { trigger: "SCHEDULED", scheduleId: schedule.id, slotKey: rows[0].slotKey! })).toBeNull();
    expect(await db.backup.count({ where: { serviceId: service.id } })).toBe(1);
  });

  it("restores a backup into the same VM only with the typed server name", async () => {
    const service = await createService(1003);
    const backup = (await requestVdsBackup(service.id, { trigger: "MANUAL" }))!;
    await runVdsBackupJob(backup.id, job);

    await expect(requestVdsRestore(backup.id, { confirmation: "yanlis" })).rejects.toMatchObject({ code: "CONFIRMATION" });
    await requestVdsRestore(backup.id, { confirmation: vmNameFor(service.id) });
    await expect(requestVdsRestore(backup.id, { confirmation: vmNameFor(service.id) })).rejects.toMatchObject({ code: "BUSY" });
    expect(queued.jobs.at(-1)).toMatchObject({ name: "backup.restore", payload: { backupId: backup.id } });

    await runVdsRestoreJob(backup.id, job);
    const restored = await db.backup.findUniqueOrThrow({ where: { id: backup.id } });
    expect(restored.restoreStatus).toBe("done");
    const restoreCall = pve.calls.find((call) => call.method === "POST" && call.path === "/nodes/pve/qemu")!;
    expect(restoreCall.params.get("archive")).toBe(restored.volid);
    expect(restoreCall.params.get("force")).toBe("1");
    expect(pve.vms.get(1003)!.status).toBe("running");
    expect(await db.domainEvent.count({ where: { aggregateId: service.id, type: "backup.restored" } })).toBe(1);
  });

  it("termination: final backup first, no destroy when it fails, destroy after it completes, expiry cleanup", async () => {
    const service = await createService(1004);
    await db.service.update({ where: { id: service.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    const load = () => db.service.findUniqueOrThrow({ where: { id: service.id }, include: { product: { include: { category: true } }, customer: true } });

    // 1) Cancel → final backup queued, VM untouched.
    const pending = await terminateRemoteService(await load());
    expect(pending).toMatchObject({ ok: false, skipped: true, error: "FINAL_BACKUP_PENDING" });
    const firstFinal = await db.backup.findFirstOrThrow({ where: { serviceId: service.id, trigger: "FINAL" } });

    // 2) The final backup fails for good → VM still there, admin flagged.
    pve.failNextBackup = "ERROR: storage offline";
    await runVdsBackupJob(firstFinal.id, lastAttempt);
    expect(await db.backup.findUniqueOrThrow({ where: { id: firstFinal.id } })).toMatchObject({ status: "FAILED" });
    expect(pve.vms.has(1004)).toBe(true);
    expect(pve.paths("DELETE")).toEqual([]);
    const flagged = await load();
    expect(JSON.stringify(flagged.moduleData)).toContain("Fesih öncesi son yedek alınamadı");

    // 3) Retry (admin) → a new final backup; it completes → server.terminate destroys the VM.
    const retry = await terminateRemoteService(await load());
    expect(retry).toMatchObject({ ok: false, error: "FINAL_BACKUP_PENDING" });
    const secondFinal = await db.backup.findFirstOrThrow({ where: { serviceId: service.id, trigger: "FINAL", status: "SCHEDULED" } });
    await runVdsBackupJob(secondFinal.id, job);
    const completed = await db.backup.findUniqueOrThrow({ where: { id: secondFinal.id } });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.expiresAt!.getTime() - completed.completedAt!.getTime()).toBe(14 * 24 * 60 * 60 * 1000);
    // Offline backup: the VM was shut down before vzdump.
    const posts = pve.paths("POST");
    expect(posts.lastIndexOf("POST /nodes/pve/qemu/1004/status/shutdown")).toBeLessThan(posts.lastIndexOf("POST /nodes/pve/vzdump"));
    expect(queued.jobs.at(-1)).toMatchObject({ name: "server.terminate", payload: { serviceId: service.id } });

    await runServerTerminateJob(service.id, job);
    expect(pve.vms.has(1004)).toBe(false);
    expect((await load()).remoteId).toBeNull();

    // 4) Expired final backup → deleted by the run-backups maintenance.
    await db.backup.update({ where: { id: secondFinal.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const maintenance = await runVdsBackupMaintenance();
    expect(maintenance.expiredIds).toContain(secondFinal.id);
    expect((await db.backup.findUniqueOrThrow({ where: { id: secondFinal.id } })).deletedAt).not.toBeNull();
    expect(pve.archives("local").some((archive) => archive.volid === completed.volid)).toBe(false);
  });

  it("the admin's skip flag destroys without a final backup", async () => {
    const service = await createService(1005);
    await db.service.update({ where: { id: service.id }, data: { status: "CANCELLED" } });
    const loaded = await db.service.findUniqueOrThrow({ where: { id: service.id }, include: { product: { include: { category: true } }, customer: true } });

    const result = await terminateRemoteService(loaded, { skipFinalBackup: true, actorId: null });

    expect(result.ok).toBe(true);
    expect(pve.vms.has(1005)).toBe(false);
    expect(await db.backup.count({ where: { serviceId: service.id } })).toBe(0);
  });
});
