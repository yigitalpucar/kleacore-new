import { describe, expect, it } from "vitest";
import { JOBS, schedulePayload } from "../../../scripts/setup-dokploy-schedules.mjs";

type Job = { name: string; cron: string; job: string };

describe("Dokploy cron schedules", () => {
  it("run via sh + the in-image wget helper, not bash/curl", () => {
    for (const job of JOBS as Job[]) {
      const payload = schedulePayload(job);
      expect(payload.shellType).toBe("sh");
      expect(payload.scheduleType).toBe("application");
      expect(payload.command).toBe(`/app/cron-run.sh ${job.job}`);
      expect(payload.command).not.toMatch(/curl|bash/);
    }
  });

  it("never embeds the cron secret or shell-sensitive characters in the command", () => {
    process.env.CRON_SECRET = "super-secret-value";
    for (const job of JOBS as Job[]) {
      const { command } = schedulePayload(job);
      expect(command).not.toContain("super-secret-value");
      // Dokploy wraps the command in '...' and "..." on remote servers.
      expect(command).not.toMatch(/['"$`\\]/);
    }
  });

  it("covers every cron route", () => {
    expect((JOBS as Job[]).map((j) => j.job).sort()).toEqual([
      "auto-charge",
      "daily-billing",
      "domain-notices",
      "domain-renewals",
      "domain-sync",
      "efatura-status",
      "fx-rates",
      "jobs-drain",
      "kyc-retention",
      "notifications",
      "overdue-invoices",
      "retry-provisioning",
      "run-backups",
      "ssl-expiry",
      "support-autoclose",
      "support-mail",
      "suspend-services",
      "usage-sync",
    ]);
  });
});
