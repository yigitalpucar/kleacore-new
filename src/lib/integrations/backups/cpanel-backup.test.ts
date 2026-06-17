import { describe, expect, it } from "vitest";
import { createCpanelBackupProvider } from "./providers/cpanel-backup";
import { createDisabledBackupProvider } from "./providers/disabled";

const enabledCpanelConfig = {
  enabled: true,
  host: "whm.example.com",
  port: 2087,
  username: "root",
  apiToken: "token",
  defaultPlan: "default",
  useSsl: true,
};

describe("cpanel backup provider", () => {
  it("fails when cpanel username is missing", async () => {
    const provider = createCpanelBackupProvider(enabledCpanelConfig);

    const result = await provider.runBackup({
      serviceId: "svc-1",
      backupId: "backup-1",
      customerId: "cust-1",
      username: null,
      domain: "example.com",
      type: "FULL",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("FAILED");
    expect(result.error).toBe("CPANEL_USERNAME_MISSING");
  });

  it("fails restore when backup file path is missing", async () => {
    const provider = createCpanelBackupProvider(enabledCpanelConfig);

    const result = await provider.restoreBackup({
      backupId: "backup-1",
      serviceId: "svc-1",
      customerId: "cust-1",
      username: "siteuser",
      filePath: null,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("FAILED");
    expect(result.error).toBe("BACKUP_FILE_PATH_MISSING");
  });
});

describe("disabled backup provider", () => {
  it("returns skipped result for backup and restore", async () => {
    const provider = createDisabledBackupProvider();

    const backup = await provider.runBackup({
      serviceId: "svc-1",
      backupId: "backup-1",
      customerId: "cust-1",
    });

    const restore = await provider.restoreBackup({
      backupId: "backup-1",
      serviceId: "svc-1",
      customerId: "cust-1",
    });

    expect(backup.ok).toBe(false);
    expect(backup.skipped).toBe(true);
    expect(backup.error).toBe("BACKUP_NOT_CONFIGURED");

    expect(restore.ok).toBe(false);
    expect(restore.skipped).toBe(true);
    expect(restore.error).toBe("BACKUP_NOT_CONFIGURED");
  });
});