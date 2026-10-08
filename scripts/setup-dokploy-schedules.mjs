#!/usr/bin/env node
/**
 * Register (or repair) KLEACORE cron jobs as Dokploy application scheduled tasks.
 *
 * Each schedule runs inside the app container (node:22-alpine: busybox sh +
 * wget, no bash/curl) as `/app/cron-run.sh <job>`. That script reads
 * CRON_SECRET from the container env and calls the app on 127.0.0.1, so the
 * secret is never stored in Dokploy or written to its schedule logs.
 *
 * Idempotent: schedules are matched by name; existing ones are updated in
 * place (fixing the old `bash` + `curl` commands), missing ones are created.
 *
 * Usage:
 *   node scripts/setup-dokploy-schedules.mjs --dry-run          # print payloads only
 *   DOKPLOY_URL=https://host/api DOKPLOY_API_KEY=... node scripts/setup-dokploy-schedules.mjs
 *   node scripts/setup-dokploy-schedules.mjs --application-id=wJ-OFQk0M8mJsgGVvXbu7
 *
 * See docs/ops-cron.md.
 */
import "dotenv/config";

const DOKPLOY_URL = process.env.DOKPLOY_URL?.replace(/\/$/, "");
const DOKPLOY_API_KEY = process.env.DOKPLOY_API_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const APPLICATION_ID =
  process.argv.find((a) => a.startsWith("--application-id="))?.split("=")[1] ??
  process.env.DOKPLOY_APPLICATION_ID ??
  "wJ-OFQk0M8mJsgGVvXbu7";
const TIMEZONE = process.env.CRON_TIMEZONE ?? "Europe/Istanbul";

export const JOBS = [
  { name: "KLEACORE: Domain Senkronu (Gri)", cron: "0 1 * * *", job: "domain-sync" },
  { name: "KLEACORE: Domain Yenileme Faturaları", cron: "30 1 * * *", job: "domain-renewals" },
  { name: "KLEACORE: Günlük Faturalama", cron: "0 2 * * *", job: "daily-billing" },
  { name: "KLEACORE: Yedeklemeler", cron: "0 3 * * *", job: "run-backups" },
  { name: "KLEACORE: SSL Süre Kontrolü", cron: "0 4 * * *", job: "ssl-expiry" },
  // Disk / bandwidth of hosting accounts (one queued job per WHM instance).
  { name: "KLEACORE: Hosting Kullanım Senkronu", cron: "30 4 * * *", job: "usage-sync" },
  { name: "KLEACORE: Gecikmiş Faturalar", cron: "0 5 * * *", job: "overdue-invoices" },
  // Saved-card collection (docs/payments-saved-cards.md): after overdue marking,
  // before suspension, so a successful charge keeps the service running.
  { name: "KLEACORE: Otomatik Tahsilat", cron: "30 5 * * *", job: "auto-charge" },
  { name: "KLEACORE: Hizmet Askıya Alma", cron: "0 6 * * *", job: "suspend-services" },
  { name: "KLEACORE: Domain Süre Bildirimleri", cron: "0 10 * * *", job: "domain-notices" },
  { name: "KLEACORE: Provisioning Retry", cron: "*/15 * * * *", job: "retry-provisioning" },
  { name: "KLEACORE: E-Fatura Durumları", cron: "*/15 * * * *", job: "efatura-status" },
  // destek@ IMAP kutuları → ticket (docs/ops-support-mail.md); "5 dk içinde ticket" kabul kriteri.
  { name: "KLEACORE: Destek E-postaları", cron: "*/2 * * * *", job: "support-mail" },
  // Müşteri yanıtı beklenen talepler: uyarı (gün-1) ve otomatik kapatma.
  { name: "KLEACORE: Destek Otomatik Kapatma", cron: "15 * * * *", job: "support-autoclose" },
  // Invoice created / due-3 / overdue notices + notification outbox reconcile (daytime only).
  { name: "KLEACORE: Bildirimler", cron: "20 8-21 * * *", job: "notifications" },
  // Fallback queue worker (docs/ops-jobs.md). Keep it even with a worker service.
  { name: "KLEACORE: İş Kuyruğu", cron: "* * * * *", job: "jobs-drain" },
];

/**
 * Dokploy wraps the command as `docker exec <id> sh -c '<command>'` (remote
 * servers, inside a double-quoted echo too) or passes it as an argv element
 * (local). Keep it free of quotes and `$` so both paths run it verbatim.
 */
export function scheduleCommand(job) {
  return `/app/cron-run.sh ${job}`;
}

export function schedulePayload(job) {
  return {
    applicationId: APPLICATION_ID,
    name: job.name,
    cronExpression: job.cron,
    command: scheduleCommand(job.job),
    shellType: "sh",
    scheduleType: "application",
    enabled: true,
    timezone: TIMEZONE,
    description: `/api/cron/${job.job}`,
  };
}

async function api(method, path, body) {
  const response = await fetch(`${DOKPLOY_URL}/${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-api-key": DOKPLOY_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  if (DRY_RUN) {
    for (const job of JOBS) console.log(JSON.stringify(schedulePayload(job)));
    return;
  }
  if (!DOKPLOY_URL || !DOKPLOY_API_KEY) {
    console.error("DOKPLOY_URL and DOKPLOY_API_KEY required (or use --dry-run)");
    process.exit(1);
  }

  const query = new URLSearchParams({ id: APPLICATION_ID, scheduleType: "application" });
  const existing = (await api("GET", `schedule.list?${query}`)) ?? [];
  const byName = new Map(existing.map((s) => [s.name, s]));

  console.log(`Syncing ${JOBS.length} Dokploy schedules for ${APPLICATION_ID}...\n`);

  for (const job of JOBS) {
    const payload = schedulePayload(job);
    const current = byName.get(job.name);
    if (current) {
      await api("POST", "schedule.update", { ...payload, scheduleId: current.scheduleId });
      console.log(`↻ ${job.name} (${current.scheduleId}) updated`);
    } else {
      const created = await api("POST", "schedule.create", payload);
      console.log(`✓ ${job.name} (${created?.scheduleId ?? "created"})`);
    }
  }

  console.log("\nDone. Trigger one run from the Dokploy UI (Run now) and check its log.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
