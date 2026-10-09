#!/usr/bin/env node
/**
 * Smoke-test all KLEACORE cron endpoints with CRON_SECRET auth.
 *
 * Usage:
 *   CRON_SECRET=... node scripts/cron-healthcheck.mjs
 *   CRON_BASE_URL=https://kleacore.com CRON_SECRET=... node scripts/cron-healthcheck.mjs --verbose
 */
import "dotenv/config";

const APP_URL = (
  process.env.CRON_BASE_URL ??
  "https://kleacore.com"
).replace(/\/$/, "");

const CRON_SECRET = process.env.CRON_SECRET?.trim() ?? "";

const CRON_JOBS = [
  { id: "daily-billing", name: "Günlük Faturalama", path: "/api/cron/daily-billing" },
  { id: "run-backups", name: "Zamanlanmış Yedeklemeler", path: "/api/cron/run-backups" },
  { id: "ssl-expiry", name: "SSL Süre Kontrolü", path: "/api/cron/ssl-expiry" },
  { id: "overdue-invoices", name: "Gecikmiş Faturalar", path: "/api/cron/overdue-invoices" },
  { id: "suspend-services", name: "Hizmet Askıya Alma", path: "/api/cron/suspend-services" },
  { id: "retry-provisioning", name: "Provisioning Retry", path: "/api/cron/retry-provisioning" },
  { id: "usage-sync", name: "Hosting Kullanım Senkronu", path: "/api/cron/usage-sync" },
  { id: "support-mail", name: "Destek E-postaları", path: "/api/cron/support-mail" },
  { id: "support-autoclose", name: "Destek Otomatik Kapatma", path: "/api/cron/support-autoclose" },
  { id: "kyc-retention", name: "KYC Belge Saklama", path: "/api/cron/kyc-retention" },
  { id: "privacy-maintenance", name: "KVKK ve Güvenlik Bakımı", path: "/api/cron/privacy-maintenance" },
  { id: "efatura-status", name: "E-Fatura Durumları", path: "/api/cron/efatura-status" },
  { id: "fx-rates", name: "TCMB Kurları", path: "/api/cron/fx-rates" },
  { id: "notifications", name: "Bildirimler", path: "/api/cron/notifications" },
  { id: "jobs-drain", name: "İş Kuyruğu", path: "/api/cron/jobs-drain" },
];

function parseArgs(argv) {
  return {
    verbose: argv.includes("--verbose") || argv.includes("-v"),
    help: argv.includes("--help") || argv.includes("-h"),
    useHeader: argv.includes("--x-cron-secret"),
  };
}

function truncate(text, max = 240) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max)}…`;
}

async function probeCronJob(job, { verbose, useHeader }) {
  const url = `${APP_URL}${job.path}`;
  const started = Date.now();

  const headers = useHeader
    ? { "x-cron-secret": CRON_SECRET }
    : { authorization: `Bearer ${CRON_SECRET}` };

  let response;
  let bodyText = "";

  try {
    response = await fetch(url, {
      method: "POST",
      headers,
    });
    bodyText = await response.text();
  } catch (error) {
    return {
      job,
      ok: false,
      status: 0,
      durationMs: Date.now() - started,
      message: error instanceof Error ? error.message : String(error),
      body: "",
    };
  }

  const durationMs = Date.now() - started;
  const ok = response.ok;

  let message = ok ? "OK" : `HTTP ${response.status}`;
  if (!ok && bodyText) {
    try {
      const json = JSON.parse(bodyText);
      if (json?.error || json?.message) {
        message = json.error ?? json.message;
      }
    } catch {
      message = truncate(bodyText, 120);
    }
  }

  return {
    job,
    ok,
    status: response.status,
    durationMs,
    message,
    body: bodyText,
  };
}

function printResult(result, verbose, authMode) {
  const icon = result.ok ? "✓" : "✗";

  console.log(
    `${icon} ${result.job.name} (${result.job.path}) — ${result.status || "ERR"} — ${result.durationMs}ms — ${result.message} [${authMode}]`
  );

  if (verbose && result.body) {
    console.log(`  body: ${truncate(result.body, 500)}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`Usage:
  node scripts/cron-healthcheck.mjs [--verbose] [--x-cron-secret]

Environment:
  CRON_SECRET               Required — same value as production Dokploy env
  CRON_BASE_URL / APP_URL   Target app (default: https://kleacore.com)

Exits 0 when all endpoints return 2xx, 1 otherwise.
`);
    return;
  }

  if (!CRON_SECRET) {
    console.error("CRON_SECRET is required (set in .env or export before running)");
    process.exit(1);
  }

  console.log(`KLEACORE cron healthcheck — ${APP_URL}\n`);

  const authMode = args.useHeader ? "x-cron-secret" : "Bearer";
  const results = [];
  for (const job of CRON_JOBS) {
    const result = await probeCronJob(job, args);
    results.push(result);
    printResult(result, args.verbose, authMode);
  }

  const passed = results.filter((result) => result.ok).length;
  const failed = results.length - passed;

  console.log(`\nSummary: ${passed}/${results.length} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});