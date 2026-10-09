/**
 * VDS backups on top of a server module with the "backups" capability
 * (Proxmox vzdump / PBS) — docs/modules/proxmox.md §9.
 *
 * - A Backup row is the record (customer list, quota, admin history); the
 *   archive lives on the hypervisor's backup storage (`volid`).
 * - Every backup runs in the `backup.run` job: one active job per Proxmox
 *   node (pg-boss singleton policy), resumable through `Backup.upid`.
 * - Retention = keep last N (product slots + admin extra slots), pruned
 *   after each successful backup. Final backups (termination) expire after
 *   `finalBackupKeepDays` and are deleted by the run-backups cron.
 * - Restore overwrites the VM (same VMID) in the `backup.restore` job.
 * - Termination of a backup-capable VDS never destroys the VM without a
 *   completed final backup, unless the admin explicitly skipped it
 *   (`finalBackupGate`).
 */
import type { Backup, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import type { IntegrationResult } from "@/lib/integrations/settings";
import type { ServiceWithProduct } from "@/lib/integrations/provisioning/types";
import type { JobContext } from "@/lib/jobs/registry";
import { createLogger } from "@/lib/logger";
import type { ServerAccountContext, ServerModule } from "@/lib/modules/contracts";
import { getServerBindingForService } from "@/lib/modules/instances";
import { parseProductOptions } from "@/lib/modules/product-options";
import { buildServerContext, type ServerBinding } from "@/lib/modules/server-bridge";
import { vmNameFor } from "@/lib/modules/server/proxmox";
import { createServiceModuleState, moduleSlice, patchServiceModuleState } from "@/lib/modules/service-state";
import {
  backupQuota,
  bytesToMB,
  canStartBackup,
  decideFinalBackup,
  isStillRunning,
  nextScheduledRun,
  scheduleSlotKey,
  selectBackupsToPrune,
  type BackupFrequency,
} from "./policy";

const log = createLogger("backups.vds");

/** moduleData key for backup bookkeeping that is not module state (admin extra slots, final-backup skip). */
export const BACKUPS_STATE_KEY = "_backups";
const TIMEZONE = process.env.CRON_TIMEZONE || "Europe/Istanbul";
const DAY_MS = 24 * 60 * 60 * 1000;
/** A SCHEDULED backup whose job may have been lost (queue down) is re-queued after this long. */
const REQUEUE_AFTER_MS = 20 * 60 * 1000;

export class BackupError extends Error {
  constructor(
    readonly code:
      | "NOT_SUPPORTED"
      | "NO_BACKUPS"
      | "QUOTA_FULL"
      | "IN_PROGRESS"
      | "SERVICE_NOT_ACTIVE"
      | "NOT_FOUND"
      | "NOT_RESTORABLE"
      | "CONFIRMATION"
      | "BUSY"
      | "RATE_LIMITED"
      | "REMOTE",
    message: string
  ) {
    super(message);
    this.name = "BackupError";
  }
}

type ServiceRow = Prisma.ServiceGetPayload<{
  include: { product: { include: { category: true } }; customer: { select: { id: true; name: true; surname: true; email: true } } };
}>;

const serviceInclude = {
  product: { include: { category: true } },
  customer: { select: { id: true, name: true, surname: true, email: true } },
} as const;

interface BackupConfigView {
  backupRetention: number;
  manualBackupsPerDay: number;
  finalBackupKeepDays: number;
  backupNotifyCustomer: boolean;
  backupMode: "snapshot" | "suspend" | "stop";
  node: string;
}

export interface VdsBackupPolicy {
  quota: number;
  included: number;
  extra: number;
  manualPerDay: number;
  finalKeepDays: number;
  notifyCustomer: boolean;
  mode: BackupConfigView["backupMode"];
}

export interface VdsBackupBinding {
  binding: ServerBinding;
  module: Required<Pick<ServerModule, "createBackup" | "restoreBackup" | "deleteBackup">> & ServerModule;
  policy: VdsBackupPolicy;
  /** Node the VM runs on (for the per-node queue). */
  node: string;
}

function serviceLabel(service: { label: string; domain: string | null; product: { name: string } }) {
  return service.label || service.domain || service.product.name;
}

function configOf(binding: ServerBinding): BackupConfigView {
  const config = binding.instance.config as Partial<BackupConfigView>;
  return {
    backupRetention: config.backupRetention ?? 2,
    manualBackupsPerDay: config.manualBackupsPerDay ?? 3,
    finalBackupKeepDays: config.finalBackupKeepDays ?? 14,
    backupNotifyCustomer: config.backupNotifyCustomer ?? false,
    backupMode: config.backupMode ?? "snapshot",
    node: config.node ?? "",
  };
}

/**
 * The service's backup-capable module binding + policy, or null when the
 * service is not bound to a module that declares "backups".
 */
export async function getVdsBackupBinding(
  service: Pick<ServiceRow, "id" | "moduleInstanceId" | "moduleData"> & { product: { moduleOptions?: unknown; moduleInstanceId?: string | null } | null }
): Promise<VdsBackupBinding | null> {
  if (!service.moduleInstanceId) return null;
  const binding = await getServerBindingForService(service);
  if (!binding) return null;
  const contract = binding.module;
  if (
    !(binding.manifest.capabilities as readonly string[]).includes("backups") ||
    !contract.createBackup ||
    !contract.restoreBackup ||
    !contract.deleteBackup
  ) {
    return null;
  }
  const config = configOf(binding);
  const parsed = parseProductOptions(binding.manifest, service.product?.moduleOptions);
  const options = (parsed.success ? parsed.data : {}) as { backupSlots?: number };
  const extra = moduleSlice(service.moduleData, BACKUPS_STATE_KEY).extraSlots;
  const quota = backupQuota({
    productSlots: options.backupSlots,
    instanceDefault: config.backupRetention,
    extraSlots: typeof extra === "number" ? extra : 0,
  });
  const moduleState = moduleSlice(service.moduleData, binding.manifest.id);
  return {
    binding,
    module: contract as VdsBackupBinding["module"],
    policy: {
      quota: quota.total,
      included: quota.included,
      extra: quota.extra,
      manualPerDay: config.manualBackupsPerDay,
      finalKeepDays: config.finalBackupKeepDays,
      notifyCustomer: config.backupNotifyCustomer,
      mode: config.backupMode,
    },
    node: (typeof moduleState.node === "string" && moduleState.node) || config.node,
  };
}

function contextFor(vds: VdsBackupBinding, service: ServiceWithProduct): ServerAccountContext {
  const parsed = parseProductOptions(vds.binding.manifest, service.product?.moduleOptions);
  return {
    ...buildServerContext(vds.binding.instance, service, parsed.success ? parsed.data : {}),
    state: createServiceModuleState(service.id, vds.binding.manifest.id),
  };
}

async function loadService(serviceId: string, client: Prisma.TransactionClient | typeof db = db): Promise<ServiceRow | null> {
  return client.service.findUnique({ where: { id: serviceId }, include: serviceInclude });
}

function reinstallRunning(service: Pick<ServiceRow, "moduleData">, moduleId: string) {
  const reinstall = moduleSlice(service.moduleData, moduleId).reinstall as { phase?: string } | undefined;
  return Boolean(reinstall?.phase && ["queued", "destroy", "provision"].includes(reinstall.phase));
}

async function liveBackups(serviceId: string) {
  return db.backup.findMany({
    where: { serviceId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

function restoreBusy(rows: Array<Pick<Backup, "restoreStatus">>) {
  return rows.some((row) => row.restoreStatus === "queued" || row.restoreStatus === "running");
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

async function queueBackupRun(backup: Pick<Backup, "id" | "moduleInstanceId" | "node">) {
  try {
    const { isJobQueueReady } = await import("@/lib/provisioning/queue");
    if (!(await isJobQueueReady())) return false;
    const { enqueue } = await import("@/lib/jobs/enqueue");
    // One active vzdump per node: the key is the concurrency group, not a dedupe key.
    await enqueue("backup.run", { backupId: backup.id }, { singletonKey: `${backup.moduleInstanceId ?? "-"}:${backup.node ?? "-"}` });
    return true;
  } catch (error) {
    log.warn("backup.run not queued; the run-backups cron re-queues it", { backupId: backup.id, error });
    return false;
  }
}

type QueuedJob = { name: "backup.restore"; payload: { backupId: string } } | { name: "server.terminate"; payload: { serviceId: string } };

async function queueJob(job: QueuedJob, key: string) {
  try {
    const { isJobQueueReady } = await import("@/lib/provisioning/queue");
    if (!(await isJobQueueReady())) return false;
    const { enqueue } = await import("@/lib/jobs/enqueue");
    if (job.name === "backup.restore") await enqueue(job.name, job.payload, { singletonKey: key });
    else await enqueue(job.name, job.payload, { singletonKey: key });
    return true;
  } catch (error) {
    log.warn(`${job.name} not queued`, { key, error });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Start a backup
// ---------------------------------------------------------------------------

export interface RequestBackupOptions {
  trigger: "MANUAL" | "SCHEDULED" | "FINAL";
  actorId?: string | null;
  scheduleId?: string;
  slotKey?: string;
  /** Runs after validation, before the row is written (manual rate limit). */
  beforeCreate?(vds: VdsBackupBinding): Promise<void>;
}

/**
 * Creates the Backup row and queues `backup.run`. MANUAL/SCHEDULED need an
 * ACTIVE service, a free slot (SCHEDULED may rotate) and nothing else in
 * flight; FINAL is the termination backup (see finalBackupGate).
 * Returns null when `slotKey` was already used (schedule idempotency).
 */
export async function requestVdsBackup(serviceId: string, options: RequestBackupOptions): Promise<Backup | null> {
  const service = await loadService(serviceId);
  if (!service) throw new BackupError("NOT_FOUND", "Hizmet bulunamadı");
  const vds = await getVdsBackupBinding(service);
  if (!vds) throw new BackupError("NOT_SUPPORTED", "Bu hizmet için yedekleme desteklenmiyor");
  if (!service.remoteId) throw new BackupError("SERVICE_NOT_ACTIVE", "Sunucu henüz hazır değil");

  if (options.trigger !== "FINAL") {
    if (service.status !== "ACTIVE") throw new BackupError("SERVICE_NOT_ACTIVE", "Yedek yalnızca aktif sunucular için alınabilir");
    if (reinstallRunning(service, vds.binding.manifest.id)) throw new BackupError("BUSY", "Yeniden kurulum sürerken yedek alınamaz");
    const rows = await liveBackups(serviceId);
    if (restoreBusy(rows)) throw new BackupError("BUSY", "Geri yükleme sürerken yedek alınamaz");
    const check = canStartBackup(options.trigger, rows, vds.policy.quota);
    if (!check.ok) {
      const messages = {
        NO_BACKUPS: "Paketinizde yedekleme hakkı yok",
        QUOTA_FULL: `Yedek hakkınız dolu (${vds.policy.quota}). Yeni yedek için önce bir yedeği silin.`,
        IN_PROGRESS: "Bu sunucu için bir yedek zaten sürüyor",
      } as const;
      throw new BackupError(check.reason, messages[check.reason]);
    }
  }

  await options.beforeCreate?.(vds);

  let backup: Backup;
  try {
    backup = await db.backup.create({
      data: {
        serviceId,
        customerId: service.customerId,
        type: "FULL",
        status: "SCHEDULED",
        trigger: options.trigger,
        scheduleId: options.scheduleId,
        slotKey: options.slotKey,
        provider: vds.binding.manifest.id,
        moduleInstanceId: vds.binding.instance.id,
        node: vds.node,
        vmid: Number(service.remoteId) || null,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002" && options.slotKey) return null;
    throw error;
  }
  await queueBackupRun(backup);
  return backup;
}

// ---------------------------------------------------------------------------
// backup.run job
// ---------------------------------------------------------------------------

const TRIGGER_NOTES: Record<string, string> = { MANUAL: "manuel", SCHEDULED: "otomatik", FINAL: "fesih-oncesi" };

/** One attempt of a backup (resumes the vzdump task of an earlier attempt). Throws to retry. */
export async function runVdsBackupJob(backupId: string, context: Pick<JobContext, "isFinalAttempt">) {
  const backup = await db.backup.findUnique({ where: { id: backupId } });
  if (!backup) return { skipped: "BACKUP_NOT_FOUND" };
  if (backup.status === "COMPLETED" || backup.status === "FAILED" || backup.deletedAt) return { skipped: `STATUS_${backup.status}` };

  const service = await loadService(backup.serviceId);
  if (!service) return failBackup(backup, null, "Hizmet bulunamadı", null);
  const vds = await getVdsBackupBinding(service);
  if (!vds || !service.remoteId) return failBackup(backup, service, "Hizmet artık yedeklenebilir bir sunucuya bağlı değil", null);

  if (backup.status === "SCHEDULED") {
    await db.backup.update({ where: { id: backup.id }, data: { status: "IN_PROGRESS", startedAt: new Date(), error: null } });
  }

  const result = await vds.module.createBackup(contextFor(vds, service), {
    tag: `kleacore-backup:${backup.id}`,
    notes: `${vmNameFor(service.id)} ${TRIGGER_NOTES[backup.trigger] ?? ""}`.trim(),
    // The final backup is taken offline (VM shut down first): consistent, and the customer's server is going away anyway.
    mode: backup.trigger === "FINAL" ? "stop" : vds.policy.mode,
    shutdownFirst: backup.trigger === "FINAL",
    resumeUpid: backup.upid ?? undefined,
    onStarted: async (task) => {
      await db.backup.update({ where: { id: backup.id }, data: { upid: task.upid, node: task.node, storage: task.storage ?? null } });
    },
  });

  if (result.ok && result.data) {
    const archive = result.data;
    const completedAt = new Date();
    await db.$transaction(async (tx) => {
      await tx.backup.update({
        where: { id: backup.id },
        data: {
          status: "COMPLETED",
          completedAt,
          volid: archive.volid,
          storage: archive.storage,
          node: archive.node,
          size: bytesToMB(archive.sizeBytes),
          filePath: archive.volid,
          upid: null,
          error: null,
          expiresAt: backup.trigger === "FINAL" ? new Date(completedAt.getTime() + vds.policy.finalKeepDays * DAY_MS) : null,
        },
      });
      await emitEvent(tx, "backup.completed", {
        backupId: backup.id,
        serviceId: service.id,
        customerId: service.customerId,
        serviceLabel: serviceLabel(service),
        trigger: backup.trigger,
        sizeMB: bytesToMB(archive.sizeBytes) ?? undefined,
        completedAt,
        notifyCustomer: vds.policy.notifyCustomer && backup.trigger !== "FINAL",
      });
    });

    if (backup.trigger === "FINAL") {
      // Continue the termination now that the archive exists.
      await queueJob({ name: "server.terminate", payload: { serviceId: service.id } }, service.id);
    } else {
      await pruneVdsBackups(service.id).catch((error) => log.error("backup pruning failed", { serviceId: service.id, error }));
    }
    return { ok: true, volid: archive.volid };
  }

  const error = result.error ?? "BACKUP_FAILED";
  if (isStillRunning(error)) {
    if (!context.isFinalAttempt) throw new Error(error);
    return failBackup(backup, service, `Yedek görevi zamanında bitmedi: ${error}`, vds);
  }
  // A failed task: the next attempt starts a new one.
  await db.backup.update({ where: { id: backup.id }, data: { upid: null, error } });
  if (!context.isFinalAttempt) throw new Error(error);
  return failBackup(backup, service, error, vds);
}

async function failBackup(backup: Backup, service: ServiceRow | null, error: string, vds: VdsBackupBinding | null) {
  await db.$transaction(async (tx) => {
    await tx.backup.update({ where: { id: backup.id }, data: { status: "FAILED", error: error.slice(0, 1000), completedAt: null } });
    if (service) {
      await emitEvent(tx, "backup.failed", {
        backupId: backup.id,
        serviceId: service.id,
        customerId: service.customerId,
        serviceLabel: serviceLabel(service),
        trigger: backup.trigger,
        operation: "backup",
        error: error.slice(0, 500),
        notifyCustomer: Boolean(vds?.policy.notifyCustomer) && backup.trigger !== "FINAL",
      });
    }
  });
  if (backup.trigger === "FINAL" && service && vds) {
    await patchServiceModuleState(service.id, vds.binding.manifest.id, {
      needsAdmin: `Fesih öncesi son yedek alınamadı; VM silinmedi. Hata: ${error.slice(0, 300)}. Hizmet sayfasından yedeği yeniden deneyin veya "Yedeksiz sil" ile devam edin.`,
    }).catch(() => undefined);
  }
  return { failed: true, error };
}

// ---------------------------------------------------------------------------
// Retention
// ---------------------------------------------------------------------------

/** Deletes completed non-final archives beyond the service's quota (oldest first). */
export async function pruneVdsBackups(serviceId: string) {
  const service = await loadService(serviceId);
  if (!service) return { pruned: 0 };
  const vds = await getVdsBackupBinding(service);
  if (!vds) return { pruned: 0 };
  const rows = await db.backup.findMany({ where: { serviceId, deletedAt: null, trigger: { not: "FINAL" } } });
  const excess = selectBackupsToPrune(rows, vds.policy.quota);
  let pruned = 0;
  for (const row of excess) {
    if (await deleteArchive(vds, service, row)) pruned += 1;
  }
  return { pruned, ids: excess.map((row) => row.id) };
}

async function deleteArchive(vds: VdsBackupBinding, service: ServiceRow, row: Backup): Promise<boolean> {
  if (row.volid && row.vmid) {
    const result = await vds.module.deleteBackup(contextFor(vds, service), {
      volid: row.volid,
      storage: row.storage ?? undefined,
      node: row.node ?? undefined,
      vmid: row.vmid,
    });
    if (!result.ok) {
      log.warn("backup archive delete failed", { backupId: row.id, error: result.error });
      await db.backup.update({ where: { id: row.id }, data: { error: (result.error ?? "DELETE_FAILED").slice(0, 1000) } });
      return false;
    }
  }
  await db.backup.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
  return true;
}

// ---------------------------------------------------------------------------
// Customer / admin actions
// ---------------------------------------------------------------------------

/** Deletes one backup (archive + record). Not while it runs or is being restored. */
export async function deleteVdsBackup(backupId: string) {
  const backup = await db.backup.findUnique({ where: { id: backupId } });
  if (!backup || backup.deletedAt) throw new BackupError("NOT_FOUND", "Yedek bulunamadı");
  if (backup.status === "SCHEDULED" || backup.status === "IN_PROGRESS") throw new BackupError("BUSY", "Devam eden yedek silinemez");
  if (backup.restoreStatus === "queued" || backup.restoreStatus === "running") {
    throw new BackupError("BUSY", "Geri yüklenen yedek silinemez");
  }
  const service = await loadService(backup.serviceId);
  if (!service) throw new BackupError("NOT_FOUND", "Hizmet bulunamadı");
  const vds = await getVdsBackupBinding(service);
  if (!vds) {
    // Module unbound: only the record can go (a FAILED backup has no archive).
    if (backup.volid) throw new BackupError("NOT_SUPPORTED", "Yedek deposuna erişilemiyor");
    await db.backup.update({ where: { id: backup.id }, data: { deletedAt: new Date() } });
    return;
  }
  if (!(await deleteArchive(vds, service, backup))) throw new BackupError("REMOTE", "Yedek silinemedi, lütfen daha sonra tekrar deneyin");
}

/**
 * Queues a restore of `backupId` into its own service (customer) or, for an
 * admin restoring a final backup into a new service, into `targetServiceId`.
 * The caller must have checked access; `confirmation` must be the target
 * server name (kc-…).
 */
export async function requestVdsRestore(backupId: string, input: { confirmation: string; targetServiceId?: string }) {
  const backup = await db.backup.findUnique({ where: { id: backupId } });
  if (!backup || backup.deletedAt) throw new BackupError("NOT_FOUND", "Yedek bulunamadı");
  if (backup.status !== "COMPLETED" || !backup.volid) throw new BackupError("NOT_RESTORABLE", "Bu yedek geri yüklenemez");
  const targetId = input.targetServiceId ?? backup.serviceId;
  const target = await loadService(targetId);
  if (!target) throw new BackupError("NOT_FOUND", "Hizmet bulunamadı");
  if (target.status !== "ACTIVE" || !target.remoteId) throw new BackupError("SERVICE_NOT_ACTIVE", "Geri yükleme yalnızca aktif sunucuya yapılabilir");
  if (input.confirmation.trim() !== vmNameFor(target.id)) {
    throw new BackupError("CONFIRMATION", "Onay için sunucu adını doğru yazın");
  }
  const vds = await getVdsBackupBinding(target);
  if (!vds) throw new BackupError("NOT_SUPPORTED", "Bu hizmet için yedekleme desteklenmiyor");
  if (targetId !== backup.serviceId && vds.binding.instance.id !== backup.moduleInstanceId) {
    throw new BackupError("NOT_RESTORABLE", "Yedek başka bir Proxmox örneğinde; bu hizmete geri yüklenemez");
  }
  if (reinstallRunning(target, vds.binding.manifest.id)) throw new BackupError("BUSY", "Yeniden kurulum sürerken geri yükleme yapılamaz");
  const targetRows = await liveBackups(targetId);
  if (targetRows.some((row) => row.status === "SCHEDULED" || row.status === "IN_PROGRESS")) {
    throw new BackupError("BUSY", "Yedek alınırken geri yükleme yapılamaz");
  }
  if (restoreBusy(targetRows) || restoreBusy([backup])) throw new BackupError("BUSY", "Bir geri yükleme zaten sürüyor");

  // Atomic claim: two clicks can't queue two restores.
  const claimed = await db.backup.updateMany({
    where: { id: backup.id, OR: [{ restoreStatus: null }, { restoreStatus: { in: ["done", "failed"] } }] },
    data: {
      restoreStatus: "queued",
      restoreRequestedAt: new Date(),
      restoreError: null,
      restoreUpid: null,
      restoreTargetId: targetId === backup.serviceId ? null : targetId,
    },
  });
  if (claimed.count === 0) throw new BackupError("BUSY", "Bir geri yükleme zaten sürüyor");
  await queueJob({ name: "backup.restore", payload: { backupId: backup.id } }, targetId);
  return { targetServiceId: targetId };
}

/** One attempt of a restore (resumes the qmrestore task of an earlier attempt). Throws to retry. */
export async function runVdsRestoreJob(backupId: string, context: Pick<JobContext, "isFinalAttempt">) {
  const backup = await db.backup.findUnique({ where: { id: backupId } });
  if (!backup || !backup.volid) return { skipped: "BACKUP_NOT_FOUND" };
  if (backup.restoreStatus !== "queued" && backup.restoreStatus !== "running") return { skipped: "NO_PENDING_RESTORE" };
  const targetId = backup.restoreTargetId ?? backup.serviceId;
  const target = await loadService(targetId);
  const vds = target ? await getVdsBackupBinding(target) : null;
  if (!target || !vds || !target.remoteId) return finishRestore(backup, target, "Hedef sunucu bulunamadı", false);

  await db.backup.update({ where: { id: backup.id }, data: { restoreStatus: "running" } });
  const result = await vds.module.restoreBackup(contextFor(vds, target), {
    volid: backup.volid,
    foreign: targetId !== backup.serviceId,
    resumeUpid: backup.restoreUpid ?? undefined,
    onStarted: async (task) => {
      await db.backup.update({ where: { id: backup.id }, data: { restoreUpid: task.upid } });
    },
  });
  if (result.ok) {
    // Usage / power state are stale after a restore.
    await patchServiceModuleState(target.id, "_usage", { collectedAt: undefined }).catch(() => undefined);
    return finishRestore(backup, target, null, targetId === backup.serviceId);
  }
  const error = result.error ?? "RESTORE_FAILED";
  if (!isStillRunning(error)) await db.backup.update({ where: { id: backup.id }, data: { restoreUpid: null, restoreError: error } });
  if (!context.isFinalAttempt) throw new Error(error);
  return finishRestore(backup, target, error, targetId === backup.serviceId);
}

async function finishRestore(backup: Backup, target: ServiceRow | null, error: string | null, notifyCustomer: boolean) {
  await db.$transaction(async (tx) => {
    await tx.backup.update({
      where: { id: backup.id },
      data: { restoreStatus: error ? "failed" : "done", restoreError: error?.slice(0, 1000) ?? null, restoreUpid: null },
    });
    if (!target) return;
    const common = {
      backupId: backup.id,
      serviceId: target.id,
      customerId: target.customerId,
      serviceLabel: serviceLabel(target),
    };
    if (error) {
      await emitEvent(tx, "backup.failed", {
        ...common,
        trigger: backup.trigger,
        operation: "restore",
        error: error.slice(0, 500),
        notifyCustomer,
      });
    } else {
      await emitEvent(tx, "backup.restored", {
        ...common,
        backupCreatedAt: backup.completedAt ?? backup.createdAt,
        notifyCustomer,
      });
    }
  });
  return error ? { failed: true, error } : { ok: true };
}

/** Manual "Şimdi yedek al" quota per service and day (rate limit). */
export async function checkManualBackupRate(serviceId: string, perDay: number) {
  const { checkRateLimit } = await import("@/lib/rate-limit");
  const limit = await checkRateLimit({ key: `vds-backup:${serviceId}`, limit: perDay, windowMs: DAY_MS });
  if (!limit.allowed) {
    const hours = Math.max(1, Math.ceil((limit.retryAfterSeconds ?? 3600) / 3600));
    throw new BackupError("RATE_LIMITED", `Günlük manuel yedek sınırına ulaşıldı (${perDay}). Yaklaşık ${hours} saat sonra tekrar deneyin.`);
  }
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

export interface VdsScheduleInput {
  frequency: "off" | BackupFrequency;
  hour: number;
  weekday?: number | null;
}

/** Customer: automatic backups on/off, daily/weekly, hour window. One schedule per service. */
export async function saveVdsBackupSchedule(serviceId: string, input: VdsScheduleInput, now = new Date()) {
  const hour = Math.min(23, Math.max(0, Math.trunc(input.hour)));
  const weekday = input.frequency === "weekly" ? Math.min(6, Math.max(0, Math.trunc(input.weekday ?? 0))) : null;
  const existing = await db.backupSchedule.findFirst({ where: { serviceId }, orderBy: { createdAt: "asc" } });
  if (input.frequency === "off") {
    if (existing) await db.backupSchedule.update({ where: { id: existing.id }, data: { isActive: false, nextRunAt: null } });
    return null;
  }
  const nextRunAt = nextScheduledRun({ frequency: input.frequency, hour, weekday }, now, TIMEZONE);
  const data = { frequency: input.frequency, hour, weekday, isActive: true, nextRunAt };
  return existing
    ? db.backupSchedule.update({ where: { id: existing.id }, data })
    : db.backupSchedule.create({ data: { serviceId, ...data } });
}

/**
 * Due VDS schedules (part of the run-backups cron). Each schedule slot is
 * claimed with a compare-and-set on nextRunAt and backed up under a unique
 * slot key, so overlapping cron runs never start two backups for one slot.
 */
export async function runVdsSchedule(
  schedule: { id: string; serviceId: string; frequency: string; hour: number; weekday: number | null; nextRunAt: Date | null },
  now: Date
): Promise<"queued" | "duplicate" | "claimed-elsewhere" | `skipped:${string}`> {
  const slot = schedule.nextRunAt ?? now;
  const next = nextScheduledRun(schedule, now, TIMEZONE);
  const claimed = await db.backupSchedule.updateMany({
    where: { id: schedule.id, nextRunAt: schedule.nextRunAt },
    data: { lastRunAt: now, nextRunAt: next },
  });
  if (claimed.count === 0) return "claimed-elsewhere";
  try {
    const backup = await requestVdsBackup(schedule.serviceId, {
      trigger: "SCHEDULED",
      scheduleId: schedule.id,
      slotKey: scheduleSlotKey(schedule.id, slot),
    });
    return backup ? "queued" : "duplicate";
  } catch (error) {
    if (error instanceof BackupError) return `skipped:${error.code}`;
    throw error;
  }
}

/** Is this service's schedule handled here (backup-capable module) rather than by the legacy provider? */
export async function isVdsBackupService(serviceId: string) {
  const service = await db.service.findUnique({
    where: { id: serviceId },
    select: { id: true, moduleInstanceId: true, moduleData: true, product: { select: { moduleOptions: true, moduleInstanceId: true } } },
  });
  if (!service?.moduleInstanceId) return false;
  try {
    return Boolean(await getVdsBackupBinding(service));
  } catch {
    return false;
  }
}

/**
 * Housekeeping in the run-backups cron: re-queue SCHEDULED backups whose job
 * was lost and delete expired final backups.
 */
export async function runVdsBackupMaintenance(now = new Date()) {
  const stale = await db.backup.findMany({
    where: {
      provider: { not: null },
      moduleInstanceId: { not: null },
      status: "SCHEDULED",
      deletedAt: null,
      createdAt: { lte: new Date(now.getTime() - REQUEUE_AFTER_MS) },
    },
    select: { id: true, moduleInstanceId: true, node: true },
    take: 100,
  });
  for (const row of stale) await queueBackupRun(row);

  const expired = await db.backup.findMany({
    where: { trigger: "FINAL", status: "COMPLETED", deletedAt: null, expiresAt: { lte: now } },
    take: 100,
  });
  let deleted = 0;
  for (const row of expired) {
    try {
      const service = await loadService(row.serviceId);
      // The terminated service keeps its module instance (only remoteId is detached).
      const vds = service ? await getVdsBackupBinding({ ...service, moduleInstanceId: row.moduleInstanceId ?? service.moduleInstanceId }) : null;
      if (!service || !vds) continue;
      if (await deleteArchive(vds, service, row)) deleted += 1;
    } catch (error) {
      log.error("final backup cleanup failed", { backupId: row.id, error });
    }
  }
  return { requeued: stale.length, expiredDeleted: deleted, expiredIds: expired.map((row) => row.id) };
}

// ---------------------------------------------------------------------------
// Termination
// ---------------------------------------------------------------------------

export interface TerminateOptions {
  /** Admin explicitly chose to destroy without a final backup. */
  skipFinalBackup?: boolean;
  actorId?: string | null;
}

/**
 * Called by terminateRemoteService before the module destroys anything.
 * Returns null when termination may proceed (not a backup-capable VDS, a
 * final backup completed, or the admin skipped it); otherwise a result that
 * stops the caller: the final backup was queued / is running, or the gate
 * could not decide (never destroy on doubt).
 */
export async function finalBackupGate(
  service: Pick<ServiceRow, "id" | "moduleInstanceId" | "remoteId" | "moduleData"> & { product?: { moduleOptions?: unknown; moduleInstanceId?: string | null } | null },
  options: TerminateOptions = {}
): Promise<IntegrationResult<{ reference?: string }> | null> {
  if (!service.moduleInstanceId || !service.remoteId) return null;
  let vds: VdsBackupBinding | null;
  try {
    vds = await getVdsBackupBinding({ ...service, product: service.product ?? null });
  } catch (error) {
    return { ok: false, provider: "backups", error: `FINAL_BACKUP_CHECK_FAILED: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!vds) return null;

  const finals = await db.backup.findMany({ where: { serviceId: service.id, trigger: "FINAL" } });
  const decision = decideFinalBackup(finals, options);
  if (decision.action === "destroy") {
    if (decision.reason === "SKIPPED") {
      await patchServiceModuleState(service.id, BACKUPS_STATE_KEY, {
        finalBackupSkippedAt: new Date().toISOString(),
        finalBackupSkippedBy: options.actorId ?? null,
      });
      log.warn("terminating VDS without a final backup (admin skipped it)", { serviceId: service.id, actorId: options.actorId });
    }
    return null;
  }
  if (decision.action === "wait") {
    return { ok: false, skipped: true, provider: vds.binding.manifest.id, error: "FINAL_BACKUP_PENDING", reference: decision.backupId };
  }
  const backup = await requestVdsBackup(service.id, { trigger: "FINAL", actorId: options.actorId });
  if (decision.previousFailed) {
    await patchServiceModuleState(service.id, vds.binding.manifest.id, { needsAdmin: undefined }).catch(() => undefined);
  }
  return { ok: false, skipped: true, provider: vds.binding.manifest.id, error: "FINAL_BACKUP_PENDING", reference: backup?.id };
}

/**
 * server.terminate job: continues a termination after its final backup
 * completed. Only for services that are still CANCELLED (an admin who
 * re-activated the service in the meantime stops it).
 */
export async function runServerTerminateJob(serviceId: string, context: Pick<JobContext, "isFinalAttempt">) {
  const service = await loadService(serviceId);
  if (!service) return { skipped: "SERVICE_NOT_FOUND" };
  if (service.status !== "CANCELLED") return { skipped: `STATUS_${service.status}` };
  if (!service.remoteId) return { skipped: "ALREADY_TERMINATED" };
  const { terminateRemoteService } = await import("@/lib/integrations/provisioning");
  const result = await terminateRemoteService(service);
  if (result.ok) return { ok: true };
  if (result.error === "FINAL_BACKUP_PENDING") return { skipped: "FINAL_BACKUP_PENDING" };
  if (context.isFinalAttempt && service.moduleInstanceId) {
    const binding = await getServerBindingForService(service).catch(() => null);
    if (binding) {
      await patchServiceModuleState(service.id, binding.manifest.id, {
        needsAdmin: `Son yedek alındı ama VM silinemedi: ${(result.error ?? "bilinmeyen hata").slice(0, 300)}`,
      }).catch(() => undefined);
    }
  }
  throw new Error(result.error ?? "TERMINATE_FAILED");
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export interface VdsBackupRowView {
  id: string;
  trigger: "MANUAL" | "SCHEDULED" | "FINAL";
  status: string;
  sizeMB: number | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  error: string | null;
  restoreStatus: string | null;
  restoreError: string | null;
}

export interface VdsBackupsView {
  serviceId: string;
  hostname: string;
  quota: number;
  used: number;
  usedMB: number;
  manualPerDay: number;
  /** Service ACTIVE with a provisioned VM (restore / backup possible). */
  active: boolean;
  canCreate: boolean;
  blockedReason: string | null;
  restoreRunning: boolean;
  schedule: { frequency: "off" | BackupFrequency; hour: number; weekday: number | null; nextRunAt: string | null; lastRunAt: string | null };
  backups: VdsBackupRowView[];
}

function rowView(row: Backup): VdsBackupRowView {
  return {
    id: row.id,
    trigger: row.trigger,
    status: row.status,
    sizeMB: row.size ?? null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    error: row.status === "FAILED" ? "Yedek alınamadı" : null,
    restoreStatus: row.restoreStatus,
    restoreError: row.restoreStatus === "failed" ? "Geri yükleme tamamlanamadı" : null,
  };
}

/** Customer view of a VDS's backups (no volids, no error details). Null when not backup-capable. */
export async function getVdsBackupsView(
  service: Pick<ServiceRow, "id" | "status" | "remoteId" | "moduleInstanceId" | "moduleData"> & { product: { moduleOptions?: unknown; moduleInstanceId?: string | null } | null }
): Promise<VdsBackupsView | null> {
  let vds: VdsBackupBinding | null = null;
  try {
    vds = await getVdsBackupBinding(service);
  } catch {
    return null;
  }
  if (!vds) return null;
  const [rows, schedule] = await Promise.all([
    db.backup.findMany({ where: { serviceId: service.id, deletedAt: null, trigger: { not: "FINAL" } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.backupSchedule.findFirst({ where: { serviceId: service.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const check = canStartBackup("MANUAL", rows, vds.policy.quota);
  const restoreRunning = restoreBusy(rows);
  const reasons: Record<string, string> = {
    NO_BACKUPS: "Paketinizde yedekleme hakkı yok.",
    QUOTA_FULL: "Yedek hakkınız dolu. Yeni yedek için önce bir yedeği silin.",
    IN_PROGRESS: "Bir yedek alınıyor.",
  };
  let blockedReason: string | null = null;
  if (service.status !== "ACTIVE" || !service.remoteId) blockedReason = "Yedek yalnızca aktif sunucular için alınabilir.";
  else if (reinstallRunning(service, vds.binding.manifest.id)) blockedReason = "Yeniden kurulum sürüyor.";
  else if (restoreRunning) blockedReason = "Geri yükleme sürüyor.";
  else if (!check.ok) blockedReason = reasons[check.reason];

  const occupying = rows.filter((row) => row.status !== "FAILED");
  return {
    serviceId: service.id,
    hostname: vmNameFor(service.id),
    quota: vds.policy.quota,
    used: occupying.length,
    usedMB: Math.round(occupying.reduce((sum, row) => sum + (row.size ?? 0), 0) * 10) / 10,
    manualPerDay: vds.policy.manualPerDay,
    active: service.status === "ACTIVE" && Boolean(service.remoteId),
    canCreate: blockedReason === null,
    blockedReason,
    restoreRunning,
    schedule: {
      frequency: schedule?.isActive ? (schedule.frequency === "weekly" ? "weekly" : "daily") : "off",
      hour: schedule?.hour ?? 3,
      weekday: schedule?.weekday ?? null,
      nextRunAt: schedule?.isActive && schedule.nextRunAt ? schedule.nextRunAt.toISOString() : null,
      lastRunAt: schedule?.lastRunAt?.toISOString() ?? null,
    },
    backups: rows.map(rowView),
  };
}

export interface AdminVdsBackupRow extends VdsBackupRowView {
  volid: string | null;
  storage: string | null;
  node: string | null;
  rawError: string | null;
  rawRestoreError: string | null;
  deletedAt: string | null;
}

export interface AdminVdsBackupsView {
  quota: number;
  included: number;
  extra: number;
  finalKeepDays: number;
  finalBackupSkippedAt: string | null;
  backups: AdminVdsBackupRow[];
}

/** Admin: every backup incl. final / deleted ones, with storage details. */
export async function getAdminVdsBackupsView(
  service: Pick<ServiceRow, "id" | "moduleInstanceId" | "moduleData"> & { product: { moduleOptions?: unknown; moduleInstanceId?: string | null } | null }
): Promise<AdminVdsBackupsView | null> {
  let vds: VdsBackupBinding | null = null;
  try {
    vds = await getVdsBackupBinding(service);
  } catch {
    return null;
  }
  if (!vds) return null;
  const rows = await db.backup.findMany({ where: { serviceId: service.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const state = moduleSlice(service.moduleData, BACKUPS_STATE_KEY);
  return {
    quota: vds.policy.quota,
    included: vds.policy.included,
    extra: vds.policy.extra,
    finalKeepDays: vds.policy.finalKeepDays,
    finalBackupSkippedAt: typeof state.finalBackupSkippedAt === "string" ? state.finalBackupSkippedAt : null,
    backups: rows.map((row) => ({
      ...rowView(row),
      volid: row.volid,
      storage: row.storage,
      node: row.node,
      rawError: row.error,
      rawRestoreError: row.restoreError,
      deletedAt: row.deletedAt?.toISOString() ?? null,
    })),
  };
}

/** Admin: extra backup slots on top of the product's (e.g. a sold "ek yedek" add-on). */
export async function setVdsExtraBackupSlots(serviceId: string, extraSlots: number) {
  const value = Math.min(50, Math.max(0, Math.trunc(extraSlots)));
  await patchServiceModuleState(serviceId, BACKUPS_STATE_KEY, { extraSlots: value || undefined });
  return value;
}

/** Admin: keep a final backup longer (or shorter) than the instance default. */
export async function setFinalBackupExpiry(backupId: string, expiresAt: Date) {
  const backup = await db.backup.findUnique({ where: { id: backupId } });
  if (!backup || backup.trigger !== "FINAL" || backup.deletedAt) throw new BackupError("NOT_FOUND", "Son yedek bulunamadı");
  await db.backup.update({ where: { id: backupId }, data: { expiresAt } });
}
