#!/usr/bin/env node
/**
 * Register KLEACORE production cron jobs via cron-job.org API,
 * or print curl commands / Dokploy scheduled-task instructions.
 *
 * Usage:
 *   node scripts/setup-cron-jobs.mjs              # print manual setup (default)
 *   node scripts/setup-cron-jobs.mjs --register   # register via cron-job.org API
 *   node scripts/setup-cron-jobs.mjs --list       # list cron-job.org jobs (API key required)
 */
import "dotenv/config";

const APP_URL = (
  process.env.CRON_BASE_URL ??
  "https://kleacore.com"
).replace(/\/$/, "");

const CRON_SECRET = process.env.CRON_SECRET?.trim() ?? "";
const CRON_JOB_ORG_API_KEY = process.env.CRON_JOB_ORG_API_KEY?.trim() ?? "";
const CRON_TIMEZONE = process.env.CRON_TIMEZONE ?? "Europe/Istanbul";
const CRON_JOB_ORG_API = "https://api.cron-job.org";

/** Matches vercel.json and src/lib/integrations/module-status.ts */
const CRON_JOBS = [
  {
    id: "daily-billing",
    name: "Günlük Faturalama",
    path: "/api/cron/daily-billing",
    schedule: "0 2 * * *",
    description: "Yenileme faturaları oluştur",
  },
  {
    id: "run-backups",
    name: "Zamanlanmış Yedeklemeler",
    path: "/api/cron/run-backups",
    schedule: "0 3 * * *",
    description: "Zamanlanmış yedeklemeleri çalıştır",
  },
  {
    id: "ssl-expiry",
    name: "SSL Süre Kontrolü",
    path: "/api/cron/ssl-expiry",
    schedule: "0 4 * * *",
    description: "SSL sertifika sürelerini kontrol et",
  },
  {
    id: "overdue-invoices",
    name: "Gecikmiş Faturalar",
    path: "/api/cron/overdue-invoices",
    schedule: "0 5 * * *",
    description: "Gecikmiş faturaları işaretle",
  },
  {
    id: "suspend-services",
    name: "Hizmet Askıya Alma",
    path: "/api/cron/suspend-services",
    schedule: "0 6 * * *",
    description: "Gecikmiş ödemelerde hizmetleri askıya al",
  },
  {
    id: "retry-provisioning",
    name: "Provisioning Retry",
    path: "/api/cron/retry-provisioning",
    schedule: "*/15 * * * *",
    description: "Başarısız provisioning işlerini yeniden dene",
  },
];

const REQUEST_METHOD_POST = 1;

function jobTitle(job) {
  return `KLEACORE: ${job.name}`;
}

function jobUrl(job) {
  return `${APP_URL}${job.path}`;
}

function parseCronSchedule(expression) {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Unsupported cron expression: ${expression}`);
  }

  const [minute, hour] = parts;
  const schedule = {
    timezone: CRON_TIMEZONE,
    expiresAt: 0,
    months: [-1],
    mdays: [-1],
    wdays: [-1],
    hours: [-1],
    minutes: [-1],
  };

  if (minute.startsWith("*/")) {
    const step = Number(minute.slice(2));
    if (!Number.isFinite(step) || step < 1 || step > 59) {
      throw new Error(`Unsupported minute step: ${minute}`);
    }
    schedule.minutes = Array.from(
      { length: Math.floor(60 / step) },
      (_, index) => index * step
    );
  } else if (minute === "*") {
    schedule.minutes = [-1];
  } else {
    schedule.minutes = [Number(minute)];
  }

  if (hour === "*") {
    schedule.hours = [-1];
  } else {
    schedule.hours = [Number(hour)];
  }

  return schedule;
}

function buildCronJobOrgPayload(job) {
  return {
    job: {
      title: jobTitle(job),
      enabled: true,
      saveResponses: true,
      url: jobUrl(job),
      requestMethod: REQUEST_METHOD_POST,
      requestTimeout: 300,
      schedule: parseCronSchedule(job.schedule),
      extendedData: {
        headers: {
          Authorization: `Bearer ${CRON_SECRET}`,
        },
      },
      notification: {
        onFailure: true,
        onFailureCount: 1,
        onSuccess: false,
        onDisable: true,
      },
    },
  };
}

function printCurlCommand(job) {
  const url = jobUrl(job);
  return [
    `# ${job.name} — ${job.description}`,
    `curl -sS -X POST "${url}" \\`,
    `  -H "Authorization: Bearer $CRON_SECRET"`,
  ].join("\n");
}

function printDokployInstructions() {
  console.log("=== Dokploy Scheduled Tasks (manual) ===\n");
  console.log(
    "Dokploy panel → Application → Scheduled Tasks → Add task for each job below."
  );
  console.log("Use the cron expression in Schedule and the curl command in Command.\n");
  console.log(
    "Prerequisite: CRON_SECRET must be set in the application environment (already in Dokploy env).\n"
  );

  for (const job of CRON_JOBS) {
    console.log(`--- ${job.name} (${job.id}) ---`);
    console.log(`Schedule (cron): ${job.schedule}`);
    console.log(`Timezone: ${CRON_TIMEZONE}`);
    console.log(`Command:\n${printCurlCommand(job)}\n`);
  }
}

function printManualSetup() {
  console.log("=== KLEACORE Cron Job Setup ===\n");
  console.log(`App URL: ${APP_URL}`);
  console.log(`Timezone: ${CRON_TIMEZONE}`);
  console.log(
    `CRON_SECRET: ${CRON_SECRET ? "(set in environment)" : "(missing — export CRON_SECRET before running jobs)"}`
  );
  console.log(
    "\nAuth: Authorization: Bearer $CRON_SECRET  or  x-cron-secret: $CRON_SECRET\n"
  );

  console.log("=== curl commands (copy/paste) ===\n");
  for (const job of CRON_JOBS) {
    console.log(printCurlCommand(job));
    console.log("");
  }

  console.log("");
  printDokployInstructions();

  console.log("=== cron-job.org (API registration) ===\n");
  console.log(
    "Set CRON_JOB_ORG_API_KEY (from https://console.cron-job.org → Settings) and run:"
  );
  console.log("  CRON_SECRET=... CRON_JOB_ORG_API_KEY=... node scripts/setup-cron-jobs.mjs --register\n");
}

async function cronJobOrgApi(path, { method = "GET", body } = {}) {
  if (!CRON_JOB_ORG_API_KEY) {
    throw new Error("CRON_JOB_ORG_API_KEY is required for cron-job.org API calls");
  }

  const response = await fetch(`${CRON_JOB_ORG_API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${CRON_JOB_ORG_API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `cron-job.org ${method} ${path} failed (${response.status}): ${text}`
    );
  }

  return data;
}

async function listCronJobOrgJobs() {
  const data = await cronJobOrgApi("/jobs");
  const jobs = data.jobs ?? [];
  const kleacoreJobs = jobs.filter((job) => job.title?.startsWith("KLEACORE:"));

  console.log(`Found ${kleacoreJobs.length} KLEACORE job(s) on cron-job.org:\n`);
  for (const job of kleacoreJobs) {
    console.log(`  [${job.jobId}] ${job.title}`);
    console.log(`    url: ${job.url}`);
    console.log(`    enabled: ${job.enabled}`);
    console.log("");
  }

  if (kleacoreJobs.length === 0) {
    console.log("  (none — run with --register to create them)\n");
  }
}

async function registerCronJobOrgJobs() {
  if (!CRON_SECRET) {
    throw new Error("CRON_SECRET is required to register cron-job.org jobs");
  }
  if (!CRON_JOB_ORG_API_KEY) {
    throw new Error("CRON_JOB_ORG_API_KEY is required (get it from cron-job.org console)");
  }

  const existing = await cronJobOrgApi("/jobs");
  const byTitle = new Map(
    (existing.jobs ?? [])
      .filter((job) => job.title?.startsWith("KLEACORE:"))
      .map((job) => [job.title, job])
  );

  console.log(`Registering ${CRON_JOBS.length} cron jobs for ${APP_URL}...\n`);

  for (const job of CRON_JOBS) {
    const title = jobTitle(job);
    const payload = buildCronJobOrgPayload(job);
    const found = byTitle.get(title);

    if (found) {
      await cronJobOrgApi(`/jobs/${found.jobId}`, {
        method: "PATCH",
        body: payload,
      });
      console.log(`Updated: ${title} (jobId ${found.jobId})`);
    } else {
      const created = await cronJobOrgApi("/jobs", {
        method: "PUT",
        body: payload,
      });
      console.log(`Created: ${title} (jobId ${created.jobId})`);
      await sleep(1100);
    }
  }

  console.log("\nDone. Verify with: node scripts/setup-cron-jobs.mjs --list");
  console.log("Smoke test: node scripts/cron-healthcheck.mjs");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  return {
    register: argv.includes("--register"),
    list: argv.includes("--list"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`Usage:
  node scripts/setup-cron-jobs.mjs              Print curl + Dokploy instructions
  node scripts/setup-cron-jobs.mjs --register   Register/update jobs on cron-job.org
  node scripts/setup-cron-jobs.mjs --list       List KLEACORE jobs on cron-job.org

Environment:
  APP_URL / CRON_BASE_URL   Target app (default: https://kleacore.com)
  CRON_SECRET               Required for --register
  CRON_JOB_ORG_API_KEY      Required for --register / --list
  CRON_TIMEZONE             Schedule timezone (default: Europe/Istanbul)
`);
    return;
  }

  if (args.list) {
    await listCronJobOrgJobs();
    return;
  }

  if (args.register) {
    await registerCronJobOrgJobs();
    return;
  }

  printManualSetup();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});