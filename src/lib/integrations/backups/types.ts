import type { BackupType } from "@prisma/client";

export type BackupJobStatus = "COMPLETED" | "FAILED" | "IN_PROGRESS";

export interface BackupJobResult {
  ok: boolean;
  skipped?: boolean;
  status: BackupJobStatus;
  provider?: string;
  size?: number;
  filePath?: string;
  externalId?: string;
  providerResponse?: unknown;
  error?: string;
}

export interface BackupRunInput {
  serviceId: string;
  backupId: string;
  customerId: string;
  username?: string | null;
  domain?: string | null;
  type?: BackupType;
}

export interface BackupRestoreInput {
  backupId: string;
  serviceId: string;
  customerId: string;
  username?: string | null;
  filePath?: string | null;
}

export interface BackupProvider {
  name: string;
  runBackup(input: BackupRunInput): Promise<BackupJobResult>;
  restoreBackup(input: BackupRestoreInput): Promise<BackupJobResult>;
}

export interface BackupConfig {
  enabled: boolean;
  cpanelConfigured: boolean;
}