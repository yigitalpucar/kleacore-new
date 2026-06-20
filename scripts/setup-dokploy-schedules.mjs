#!/usr/bin/env node
/**
 * Register KLEACORE cron jobs as Dokploy application scheduled tasks.
 *
 * Usage:
 *   DOKPLOY_URL=... DOKPLOY_API_KEY=... CRON_SECRET=... node scripts/setup-dokploy-schedules.mjs
 *   node scripts/setup-dokploy-schedules.mjs --application-id wJ-OFQk0M8mJsgGVvXbu7
 */
import "dotenv/config";

const DOKPLOY_URL = process.env.DOKPLOY_URL?.replace(/\/$/, "");
const DOKPLOY_API_KEY = process.env.DOKPLOY_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET?.trim() ?? "";
const APP_URL = (process.env.CRON_BASE_URL ?? "https://kleacore.com").replace(/\/$/, "");
const APPLICATION_ID =
  process.argv.find((a) => a.startsWith("--application-id="))?.split("=")[1] ??
  process.env.DOKPLOY_APPLICATION_ID ??
  "wJ-OFQk0M8mJsgGVvXbu7";
const TIMEZONE = process.env.CRON_TIMEZONE ?? "Europe/Istanbul";

const JOBS = [
  { name: "KLEACORE: Günlük Faturalama", cron: "0 2 * * *", path: "/api/cron/daily-billing" },
  { name: "KLEACORE: Yedeklemeler", cron: "0 3 * * *", path: "/api/cron/run-backups" },
  { name: "KLEACORE: SSL Süre Kontrolü", cron: "0 4 * * *", path: "/api/cron/ssl-expiry" },
  { name: "KLEACORE: Gecikmiş Faturalar", cron: "0 5 * * *", path: "/api/cron/overdue-invoices" },
  { name: "KLEACORE: Hizmet Askıya Alma", cron: "0 6 * * *", path: "/api/cron/suspend-services" },
  { name: "KLEACORE: Provisioning Retry", cron: "*/15 * * * *", path: "/api/cron/retry-provisioning" },
];

function curlCommand(path) {
  const url = `${APP_URL}${path}`;
  return `curl -sS -X POST "${url}" -H "Authorization: Bearer ${CRON_SECRET}"`;
}

async function api(path, body) {
  const response = await fetch(`${DOKPLOY_URL}/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": DOKPLOY_API_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  if (!DOKPLOY_URL || !DOKPLOY_API_KEY) {
    console.error("DOKPLOY_URL and DOKPLOY_API_KEY required");
    process.exit(1);
  }
  if (!CRON_SECRET) {
    console.error("CRON_SECRET required");
    process.exit(1);
  }

  console.log(`Creating ${JOBS.length} Dokploy schedules for ${APPLICATION_ID}...\n`);

  for (const job of JOBS) {
    const result = await api("schedule.create", {
      applicationId: APPLICATION_ID,
      name: job.name,
      cronExpression: job.cron,
      command: curlCommand(job.path),
      shellType: "bash",
      scheduleType: "application",
      enabled: true,
      timezone: TIMEZONE,
      description: job.path,
    });
    console.log(`✓ ${job.name} (${result.scheduleId})`);
  }

  console.log("\nDone. Verify: CRON_SECRET=... node scripts/cron-healthcheck.mjs");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});