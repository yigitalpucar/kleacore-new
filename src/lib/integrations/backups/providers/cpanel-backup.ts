import type { CpanelWhmConfig } from "../../provisioning/types";
import {
  CpanelWhmApiError,
  createCpanelWhmClient,
} from "../../provisioning/providers/cpanel-whm-client";
import type { BackupProvider, BackupRestoreInput, BackupRunInput } from "../types";

const provider = "cpanel-backup";

function resolveAccountUsername(input: BackupRunInput | BackupRestoreInput) {
  if (input.username?.trim()) {
    return input.username.trim();
  }
  return null;
}

function toBackupError(error: unknown): string {
  if (error instanceof CpanelWhmApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "CPANEL_BACKUP_ERROR";
}

function extractUapiData(payload: unknown): Record<string, unknown> | undefined {
  if (!payload) {
    return undefined;
  }
  if (Array.isArray(payload)) {
    const first = payload[0];
    return typeof first === "object" && first !== null
      ? (first as Record<string, unknown>)
      : undefined;
  }
  if (typeof payload === "object") {
    return payload as Record<string, unknown>;
  }
  return undefined;
}

export function createCpanelBackupProvider(config: CpanelWhmConfig): BackupProvider {
  const client = createCpanelWhmClient(config);

  async function runCpanelBackup(username: string) {
    return client.cpanelApi(username, "Backup", "fullbackup", {
      dest: "homedir",
    });
  }

  async function listCpanelBackups(username: string) {
    return client.cpanelApi(username, "Backup", "list_backups");
  }

  return {
    name: provider,
    runBackup: async (input: BackupRunInput) => {
      const username = resolveAccountUsername(input);
      if (!username) {
        return {
          ok: false,
          status: "FAILED",
          provider,
          error: "CPANEL_USERNAME_MISSING",
        };
      }

      try {
        const response = await runCpanelBackup(username);
        const data = extractUapiData(response);
        const filePath =
          (typeof data?.result === "string" && data.result) ||
          (typeof data?.file === "string" && data.file) ||
          `/home/${username}/backup-${input.backupId}.tar.gz`;

        return {
          ok: true,
          status: "COMPLETED",
          provider,
          size: typeof data?.size === "number" ? data.size : undefined,
          filePath,
          externalId: `cpanel-${input.backupId}`,
          providerResponse: response,
        };
      } catch (error) {
        return {
          ok: false,
          status: "FAILED",
          provider,
          error: toBackupError(error),
        };
      }
    },
    restoreBackup: async (input: BackupRestoreInput) => {
      const username = resolveAccountUsername(input);
      if (!username) {
        return {
          ok: false,
          status: "FAILED",
          provider,
          error: "CPANEL_USERNAME_MISSING",
        };
      }

      if (!input.filePath?.trim()) {
        return {
          ok: false,
          status: "FAILED",
          provider,
          error: "BACKUP_FILE_PATH_MISSING",
        };
      }

      try {
        const backups = await listCpanelBackups(username);
        return {
          ok: true,
          status: "IN_PROGRESS",
          provider,
          externalId: `restore-${input.backupId}`,
          providerResponse: {
            mode: "cpanel",
            backupId: input.backupId,
            filePath: input.filePath,
            availableBackups: extractUapiData(backups),
            message: "RESTORE_INITIATED",
          },
        };
      } catch (error) {
        return {
          ok: false,
          status: "FAILED",
          provider,
          error: toBackupError(error),
        };
      }
    },
  };
}