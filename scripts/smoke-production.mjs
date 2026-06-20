#!/usr/bin/env node
/**
 * HTTP smoke test for KLEACORE production (or any deployed instance).
 *
 * Usage:
 *   node scripts/smoke-production.mjs
 *   SMOKE_BASE_URL=https://kleacore.com node scripts/smoke-production.mjs
 *   node scripts/smoke-production.mjs --verbose
 *
 * Exits 0 when all checks pass, 1 otherwise.
 */
import "dotenv/config";

const BASE_URL = (
  process.env.SMOKE_BASE_URL ??
  "https://kleacore.com"
).replace(/\/$/, "");

/** @type {{ path: string; name: string; expectStatus?: number[]; checkNextHeader?: boolean }[]} */
const PUBLIC_PAGES = [
  { path: "/", name: "Homepage", checkNextHeader: true },
  { path: "/musteri/giris", name: "Customer login" },
  { path: "/domain/kayit", name: "Domain registration" },
  { path: "/hosting/linux", name: "Linux hosting" },
  { path: "/api-docs", name: "API docs" },
];

const ACCEPTABLE_STATUSES = new Set([200, 301, 302, 307, 308]);

function parseArgs(argv) {
  return {
    verbose: argv.includes("--verbose") || argv.includes("-v"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

/**
 * @param {string} path
 * @param {{ checkNextHeader?: boolean }} options
 */
async function probePage(path, { checkNextHeader = false } = {}) {
  const url = `${BASE_URL}${path}`;
  const started = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "kleacore-smoke-production/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const durationMs = Date.now() - started;
    const status = response.status;
    const location = response.headers.get("location");
    const poweredBy = response.headers.get("x-powered-by");

    const statusOk = ACCEPTABLE_STATUSES.has(status);
    const nextHeaderOk = !checkNextHeader || poweredBy === "Next.js";

    const notes = [];
    if (!statusOk) {
      notes.push(`unexpected status ${status}`);
    } else if (status !== 200 && location) {
      notes.push(`redirect → ${location}`);
    }
    if (checkNextHeader && !nextHeaderOk) {
      notes.push(`x-powered-by: ${poweredBy ?? "(missing)"}, expected Next.js`);
    }

    return {
      path,
      ok: statusOk && nextHeaderOk,
      status,
      durationMs,
      poweredBy: checkNextHeader ? poweredBy : null,
      notes: notes.join("; ") || "OK",
    };
  } catch (error) {
    return {
      path,
      ok: false,
      status: 0,
      durationMs: Date.now() - started,
      poweredBy: null,
      notes: error instanceof Error ? error.message : String(error),
    };
  }
}

function pad(text, width) {
  const value = String(text);
  if (value.length >= width) {
    return value.slice(0, width - 1) + "…";
  }
  return value.padEnd(width);
}

function printTable(results) {
  const cols = {
    path: 22,
    status: 8,
    time: 8,
    result: 8,
    notes: 40,
  };

  const header = [
    pad("Path", cols.path),
    pad("Status", cols.status),
    pad("Time", cols.time),
    pad("Result", cols.result),
    pad("Notes", cols.notes),
  ].join(" | ");

  const divider = "-".repeat(header.length);

  console.log(header);
  console.log(divider);

  for (const row of results) {
    console.log(
      [
        pad(row.path, cols.path),
        pad(row.status || "ERR", cols.status),
        pad(`${row.durationMs}ms`, cols.time),
        pad(row.ok ? "PASS" : "FAIL", cols.result),
        pad(row.notes, cols.notes),
      ].join(" | ")
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`Usage:
  node scripts/smoke-production.mjs [--verbose]

Environment:
  SMOKE_BASE_URL / APP_URL / NEXT_PUBLIC_APP_URL
    Target deployment (default: https://kleacore.com)

Checks:
  - Public pages return HTTP 200 or expected redirect (3xx)
  - Homepage includes x-powered-by: Next.js

Exits 0 when all checks pass, 1 otherwise.
`);
    return;
  }

  console.log(`KLEACORE production smoke test — ${BASE_URL}\n`);

  const results = [];
  for (const page of PUBLIC_PAGES) {
    const result = await probePage(page.path, {
      checkNextHeader: page.checkNextHeader,
    });
    results.push(result);

    if (args.verbose) {
      const icon = result.ok ? "✓" : "✗";
      console.log(`${icon} ${page.name} (${page.path})`);
      if (result.poweredBy !== null) {
        console.log(`  x-powered-by: ${result.poweredBy ?? "(missing)"}`);
      }
    }
  }

  if (!args.verbose) {
    printTable(results);
    console.log("");
  } else {
    console.log("");
    printTable(results);
    console.log("");
  }

  const passed = results.filter((row) => row.ok).length;
  const failed = results.length - passed;

  console.log(`Summary: ${passed}/${results.length} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});