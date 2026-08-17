#!/usr/bin/env node
/**
 * KLEACORE — Extended HTTP + ops smoke test
 *
 * Usage:
 *   node scripts/smoke-extended.mjs
 *   SMOKE_BASE_URL=http://localhost:3000 node scripts/smoke-extended.mjs
 *   SMOKE_BASE_URL=https://staging.kleacore.com node scripts/smoke-extended.mjs --with-cron
 *   node scripts/smoke-extended.mjs --with-auth --verbose
 */
import "dotenv/config";

const BASE_URL = (
  process.env.SMOKE_BASE_URL ??
  process.env.APP_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://kleacore.com"
).replace(/\/$/, "");

const CRON_SECRET = process.env.CRON_SECRET?.trim() ?? "";

const PUBLIC_CHECKS = [
  { path: "/", name: "Homepage", expect: [200] },
  { path: "/musteri/giris", name: "Customer login", expect: [200] },
  { path: "/giris", name: "Login redirect", expect: [301, 302, 307, 308] },
  { path: "/domain/kayit", name: "Domain registration", expect: [200] },
  { path: "/domain/transfer", name: "Domain transfer", expect: [200] },
  { path: "/domain/whois", name: "WHOIS", expect: [200] },
  { path: "/domain/belgesiz-tr", name: "Belgesiz TR", expect: [200] },
  { path: "/hosting/linux", name: "Linux hosting", expect: [200] },
  { path: "/ssl/standart", name: "SSL standart", expect: [200] },
  { path: "/sepet", name: "Cart", expect: [200] },
  { path: "/api-docs", name: "API docs", expect: [200] },
  { path: "/api/v1/openapi", name: "OpenAPI", expect: [200] },
  { path: "/yonetim", name: "Admin (unauth)", expect: [307, 302] },
  { path: "/musteri/panel", name: "Panel (unauth)", expect: [307, 302] },
];

const CRON_CHECKS = [
  "daily-billing",
  "overdue-invoices",
  "suspend-services",
  "run-backups",
  "ssl-expiry",
  "retry-provisioning",
];

function parseArgs(argv) {
  return {
    verbose: argv.includes("--verbose") || argv.includes("-v"),
    withCron: argv.includes("--with-cron"),
    withAuth: argv.includes("--with-auth"),
    withIntegrations: argv.includes("--with-integrations"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

async function probe(path, { method = "GET", headers = {}, expect = [200] } = {}) {
  const url = `${BASE_URL}${path}`;
  const started = Date.now();

  try {
    const response = await fetch(url, {
      method,
      redirect: "manual",
      headers: {
        "User-Agent": "kleacore-smoke-extended/1.0",
        Accept: "application/json, text/html",
        ...headers,
      },
    });

    const durationMs = Date.now() - started;
    const ok = expect.includes(response.status);

    return {
      path,
      ok,
      status: response.status,
      durationMs,
      notes: ok ? "OK" : `expected ${expect.join("|")}, got ${response.status}`,
    };
  } catch (error) {
    return {
      path,
      ok: false,
      status: 0,
      durationMs: Date.now() - started,
      notes: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeCron(endpoint) {
  const path = `/api/cron/${endpoint}`;
  if (!CRON_SECRET) {
    return {
      path,
      ok: false,
      status: 0,
      durationMs: 0,
      notes: "CRON_SECRET not set",
    };
  }

  const noAuth = await probe(path, { expect: [401] });
  if (!noAuth.ok) {
    return { ...noAuth, notes: `unauth check failed: ${noAuth.notes}` };
  }

  return probe(path, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
    expect: [200],
  });
}

async function probeAuth() {
  const jar = new Map();
  const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  const ingest = (res) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(";");
      const eq = kv.indexOf("=");
      jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1));
    }
  };

  async function login(email, password, callbackUrl) {
    const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
    ingest(csrfRes);
    const { csrfToken } = await csrfRes.json();

    const body = new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: `${BASE_URL}${callbackUrl}`,
      json: "true",
    });

    const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieHeader(),
      },
      body,
      redirect: "manual",
    });
    ingest(loginRes);

    const protectedRes = await fetch(`${BASE_URL}${callbackUrl}`, {
      redirect: "manual",
      headers: { Cookie: cookieHeader() },
    });

    return {
      path: callbackUrl,
      ok: protectedRes.status === 200,
      status: protectedRes.status,
      durationMs: 0,
      notes: `${email} → ${protectedRes.status}`,
    };
  }

  return [
    await login("admin@kleacore.com", "Admin123!", "/yonetim"),
    await login("ayse@demirholding.com", "Demo123!", "/musteri/panel"),
  ];
}

function printTable(results) {
  console.log("Path".padEnd(28) + " | " + "Status".padEnd(8) + " | " + "Time".padEnd(8) + " | Result | Notes");
  console.log("-".repeat(90));
  for (const row of results) {
    console.log(
      `${row.path.padEnd(28)} | ${String(row.status || "ERR").padEnd(8)} | ${`${row.durationMs}ms`.padEnd(8)} | ${(row.ok ? "PASS" : "FAIL").padEnd(6)} | ${row.notes}`
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`Usage: node scripts/smoke-extended.mjs [options]

Options:
  --verbose            Per-check logging
  --with-cron          Test cron endpoints (needs CRON_SECRET)
  --with-auth          Test admin + customer login flows
  --with-integrations  Test /api/ops/integration-health (needs CRON_SECRET)

Environment:
  SMOKE_BASE_URL, CRON_SECRET
`);
    return;
  }

  console.log(`KLEACORE extended smoke — ${BASE_URL}\n`);

  const results = [];

  for (const check of PUBLIC_CHECKS) {
    const result = await probe(check.path, { expect: check.expect });
    results.push(result);
    if (args.verbose) {
      console.log(`${result.ok ? "✓" : "✗"} ${check.name}`);
    }
  }

  const apiKeyCheck = await probe("/api/v1/invoices", { expect: [401] });
  results.push({ ...apiKeyCheck, path: "/api/v1/invoices (no key)" });

  if (args.withCron) {
    for (const endpoint of CRON_CHECKS) {
      results.push(await probeCron(endpoint));
    }
  }

  if (args.withIntegrations) {
    results.push(
      await probe("/api/ops/integration-health", { expect: [401] })
    );
    if (CRON_SECRET) {
      results.push(
        await probe("/api/ops/integration-health", {
          headers: { Authorization: `Bearer ${CRON_SECRET}` },
          expect: [200],
        })
      );
    }
  }

  if (args.withAuth) {
    results.push(...(await probeAuth()));
  }

  console.log("");
  printTable(results);
  console.log("");

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`Summary: ${passed}/${results.length} passed, ${failed} failed`);

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});