import type { BackupProvider } from "../types";

const NOT_CONFIGURED = "BACKUP_NOT_CONFIGURED";

export function createDisabledBackupProvider(): BackupProvider {
  return {
    name: "disabled",
    runBackup: async () => ({
      ok: false,
      skipped: true,
      status: "FAILED",
      provider: "disabled",
      error: NOT_CONFIGURED,
    }),
    restoreBackup: async () => ({
      ok: false,
      skipped: true,
      status: "FAILED",
      provider: "disabled",
      error: NOT_CONFIGURED,
    }),
  };
}