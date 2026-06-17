import type { BackupType } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getCpanelWhmConfig,
  isCpanelWhmConfigured,
} from "../provisioning/config";
import { getSettingMap, isEnabled } from "../settings";
import { createCpanelBackupProvider } from "./providers/cpanel-backup";
import { createDisabledBackupProvider } from "./providers/disabled";
import type { BackupConfig, BackupJobResult, BackupProvider } from "./types";

export type {
  BackupConfig,
  BackupJobResult,
  BackupProvider,
  BackupRestoreInput,
  BackupRunInput,
} from "./types";

const BACKUP_SETTING_KEYS = [
  { key: "backup_enabled", fallback: "false" },
] as const;

export async function getBackupConfig(): Promise<BackupConfig> {
  const [settings, cpanelConfig] = await Promise.all([
    getSettingMap([...BACKUP_SETTING_KEYS]),
    getCpanelWhmConfig(),
  ]);

  const cpanelConfigured = isCpanelWhmConfigured(cpanelConfig);

  return {
    enabled: isEnabled(settings.backup_enabled),
    cpanelConfigured,
  };
}

export async function getBackupProvider(): Promise<BackupProvider> {
  const [config, cpanelConfig] = await Promise.all([
    getBackupConfig(),
    getCpanelWhmConfig(),
  ]);

  if (!config.enabled || !config.cpanelConfigured) {
    return createDisabledBackupProvider();
  }

  return createCpanelBackupProvider(cpanelConfig);
}

async function applyBackupResult(backupId: string, result: BackupJobResult) {
  await db.backup.update({
    where: { id: backupId },
    data: {
      status: result.status,
      size: result.size ?? undefined,
      filePath: result.filePath ?? undefined,
      completedAt: result.status === "COMPLETED" ? new Date() : null,
    },
  });
}

export async function runServiceBackup(
  serviceId: string,
  options?: {
    backupId?: string;
    scheduleId?: string;
    type?: BackupType;
    customerId?: string;
  }
): Promise<{ ok: boolean; backupId?: string; error?: string; skipped?: boolean }> {
  const service = await db.service.findUnique({
    where: { id: serviceId },
    select: {
      id: true,
      customerId: true,
      username: true,
      domain: true,
      status: true,
    },
  });

  if (!service) {
    return { ok: false, error: "SERVICE_NOT_FOUND" };
  }

  if (service.status !== "ACTIVE") {
    return { ok: false, error: "SERVICE_NOT_ACTIVE" };
  }

  const customerId = options?.customerId ?? service.customerId;
  let backupId = options?.backupId;

  if (!backupId) {
    const backup = await db.backup.create({
      data: {
        serviceId,
        customerId,
        scheduleId: options?.scheduleId,
        type: options?.type ?? "FULL",
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });
    backupId = backup.id;
  } else {
    await db.backup.update({
      where: { id: backupId },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
        completedAt: null,
        size: null,
        filePath: null,
      },
    });
  }

  const provider = await getBackupProvider();
  const result = await provider.runBackup({
    serviceId,
    backupId,
    customerId,
    username: service.username,
    domain: service.domain,
    type: options?.type,
  });

  await applyBackupResult(backupId, result);

  return {
    ok: result.ok,
    backupId,
    error: result.error,
    skipped: result.skipped,
  };
}

export async function restoreServiceBackup(
  backupId: string
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const backup = await db.backup.findUnique({
    where: { id: backupId },
    include: {
      service: {
        select: {
          id: true,
          customerId: true,
          username: true,
        },
      },
    },
  });

  if (!backup) {
    return { ok: false, error: "BACKUP_NOT_FOUND" };
  }

  if (backup.status !== "COMPLETED") {
    return { ok: false, error: "BACKUP_NOT_RESTORABLE" };
  }

  const provider = await getBackupProvider();
  const result = await provider.restoreBackup({
    backupId: backup.id,
    serviceId: backup.serviceId,
    customerId: backup.customerId,
    username: backup.service.username,
    filePath: backup.filePath,
  });

  return {
    ok: result.ok,
    error: result.error,
    skipped: result.skipped,
  };
}