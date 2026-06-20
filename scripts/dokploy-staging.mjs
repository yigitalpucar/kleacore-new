#!/usr/bin/env node
/**
 * KLEACORE — Dokploy staging environment bootstrap
 *
 * Creates (or reuses) a separate Dokploy project with its own Postgres instance
 * and deploys the same git repo against staging.kleacore.com.
 *
 * DNS requirement (configure before first deploy):
 *   staging.kleacore.com  →  A record  →  <Dokploy server public IP>
 *
 * Usage:
 *   node scripts/dokploy-staging.mjs
 *
 * Requires in .env:
 *   DOKPLOY_URL, DOKPLOY_API_KEY
 *
 * Optional overrides:
 *   DOKPLOY_GIT_REPO, DOKPLOY_GIT_BRANCH, DOKPLOY_GIT_SSH_KEY_ID
 *   DOKPLOY_STAGING_DOMAIN (default: staging.kleacore.com)
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";

const DOKPLOY_URL = process.env.DOKPLOY_URL?.replace(/\/$/, "");
const DOKPLOY_API_KEY = process.env.DOKPLOY_API_KEY;
const GIT_REPO =
  process.env.DOKPLOY_GIT_REPO ?? "git@github.com:yigitalpucar/kleacore-new.git";
const GIT_BRANCH = process.env.DOKPLOY_GIT_BRANCH ?? "main";
const GIT_SSH_KEY_ID =
  process.env.DOKPLOY_GIT_SSH_KEY_ID ?? "9H1ZzGL3jeIqCvsqiDWs6";
const APP_DOMAIN = process.env.DOKPLOY_STAGING_DOMAIN ?? "staging.kleacore.com";

const PROJECT_NAME = "kleacore-staging";
const PROJECT_DESCRIPTION = "KLEACORE staging environment";
const APP_NAME = "kleacore-staging-web";
const POSTGRES_NAME = "kleacore-staging-postgres";
const DB_NAME = "kleacore_staging";
const DB_USER = "kleacore_staging";

if (!DOKPLOY_URL || !DOKPLOY_API_KEY) {
  console.error("DOKPLOY_URL and DOKPLOY_API_KEY are required in .env");
  process.exit(1);
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
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${text}`);
  }

  return data;
}

async function apiGet(path) {
  const response = await fetch(`${DOKPLOY_URL}/${path}`, {
    headers: { "x-api-key": DOKPLOY_API_KEY },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function secret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function buildEnv({
  databaseUrl,
  authSecret,
  cronSecret,
  encryptionKey,
  seedAdminPassword,
}) {
  const appUrl = `https://${APP_DOMAIN}`;
  return [
    `DATABASE_URL=${databaseUrl}`,
    `AUTH_SECRET=${authSecret}`,
    `NEXTAUTH_SECRET=${authSecret}`,
    `NEXTAUTH_URL=${appUrl}`,
    `NEXT_PUBLIC_APP_URL=${appUrl}`,
    `APP_URL=${appUrl}`,
    `CRON_SECRET=${cronSecret}`,
    `ENCRYPTION_KEY=${encryptionKey}`,
    `WEBHOOK_SIGNING_SECRET=${secret()}`,
    `SEED_ADMIN_PASSWORD=${seedAdminPassword}`,
    "NODE_ENV=production",
    "EMAIL_NOTIFICATIONS=false",
    "IYZICO_TEST_MODE=true",
    "REGISTRAR_TEST_MODE=true",
  ].join("\n");
}

function printDnsRequirements() {
  console.log("\n--- DNS requirement ---");
  console.log(`Point ${APP_DOMAIN} to your Dokploy server public IP before HTTPS will work:`);
  console.log(`  Type: A`);
  console.log(`  Host: staging`);
  console.log(`  Value: <Dokploy server IP>`);
  console.log("Dokploy will request a Let's Encrypt certificate once DNS propagates.");
}

async function main() {
  console.log(`Bootstrapping KLEACORE staging on Dokploy (${APP_DOMAIN})`);

  const projects = await apiGet("project.all");
  const stagingProjects = projects.filter((project) => project.name === PROJECT_NAME);
  const existing =
    stagingProjects.find((project) =>
      project.description?.includes(PROJECT_DESCRIPTION)
    ) ??
    stagingProjects.find((project) =>
      (project.environments?.[0]?.applications?.length ?? 0) > 0 ||
      (project.environments?.[0]?.postgres?.length ?? 0) > 0
    ) ??
    stagingProjects[0];

  let projectId;
  let environmentId;

  if (existing) {
    projectId = existing.projectId;
    environmentId = existing.environments[0]?.environmentId;
    console.log(`Using existing project ${PROJECT_NAME} (${projectId})`);
  } else {
    const created = await api("project.create", {
      name: PROJECT_NAME,
      description: PROJECT_DESCRIPTION,
    });
    projectId = created.project?.projectId ?? created.projectId;
    environmentId =
      created.environment?.environmentId ??
      created.environments?.[0]?.environmentId;
    console.log(`Created project ${PROJECT_NAME} (${projectId})`);
  }

  if (!environmentId) {
    throw new Error(`Could not resolve environmentId for ${PROJECT_NAME} project`);
  }

  const refreshed = await apiGet("project.all");
  const project = refreshed.find((item) => item.projectId === projectId);
  const env = project?.environments?.[0];
  const existingPostgres = env?.postgres?.find(
    (pg) => pg.name === POSTGRES_NAME || pg.appName === POSTGRES_NAME
  );
  const existingApp = env?.applications?.find((app) => app.name === APP_NAME);

  let dbPassword = secret(24);
  const authSecret = secret();
  const cronSecret = secret();
  const encryptionKey = secret();
  const seedAdminPassword = secret(18);

  let postgresAppName = POSTGRES_NAME;
  let reusingPostgres = false;
  if (!existingPostgres) {
    const postgres = await api("postgres.create", {
      name: POSTGRES_NAME,
      appName: POSTGRES_NAME,
      databaseName: DB_NAME,
      databaseUser: DB_USER,
      databasePassword: dbPassword,
      dockerImage: "postgres:16-alpine",
      environmentId,
      description: "KLEACORE staging database (isolated from production)",
    });
    postgresAppName = postgres.appName ?? postgresAppName;
    console.log(`Created postgres (${postgres.postgresId})`);
    await api("postgres.deploy", { postgresId: postgres.postgresId });
    console.log("Postgres deploy started");
  } else {
    reusingPostgres = true;
    console.log(`Using existing postgres (${existingPostgres.postgresId})`);
    const pg = await apiGet(
      `postgres.one?postgresId=${existingPostgres.postgresId}`
    );
    postgresAppName = pg.appName;
    dbPassword = pg.databasePassword;
  }

  const databaseUrl = `postgresql://${DB_USER}:${dbPassword}@${postgresAppName}:5432/${DB_NAME}`;

  let applicationId = existingApp?.applicationId;
  if (!applicationId) {
    const application = await api("application.create", {
      name: APP_NAME,
      appName: APP_NAME,
      description: "KLEACORE Next.js application (staging)",
      environmentId,
    });
    applicationId = application.applicationId;
    console.log(`Created application ${APP_NAME} (${applicationId})`);
  } else {
    console.log(`Using existing application ${APP_NAME} (${applicationId})`);
  }

  await api("application.saveGitProvider", {
    applicationId,
    customGitUrl: GIT_REPO,
    customGitBranch: GIT_BRANCH,
    customGitBuildPath: "/",
    customGitSSHKeyId: GIT_SSH_KEY_ID,
    watchPaths: [],
    enableSubmodules: false,
  });
  console.log(`Git provider configured (${GIT_REPO} @ ${GIT_BRANCH})`);

  await api("application.saveBuildType", {
    applicationId,
    buildType: "dockerfile",
    dockerfile: "Dockerfile",
    dockerContextPath: null,
    dockerBuildStage: null,
    herokuVersion: "24",
    railpackVersion: "0.15.4",
  });
  console.log("Build type configured");

  await api("application.saveEnvironment", {
    applicationId,
    env: buildEnv({
      databaseUrl,
      authSecret,
      cronSecret,
      encryptionKey,
      seedAdminPassword,
    }),
    buildArgs: "",
    buildSecrets: "",
    createEnvFile: true,
  });
  console.log("Staging environment variables saved");

  const app = await apiGet(`application.one?applicationId=${applicationId}`);
  const hasDomain = app.domains?.some((domain) => domain.host === APP_DOMAIN);
  if (!hasDomain) {
    await api("domain.create", {
      host: APP_DOMAIN,
      applicationId,
      https: true,
      port: 3000,
      path: "/",
      certificateType: "letsencrypt",
      stripPath: false,
    });
    console.log(`Domain configured for ${APP_DOMAIN}`);
  } else {
    console.log(`Domain already configured for ${APP_DOMAIN}`);
  }

  await api("application.deploy", {
    applicationId,
    title: "KLEACORE staging Dokploy deploy",
    description: "Triggered from scripts/dokploy-staging.mjs",
  });
  console.log("Staging deployment started");

  if (!reusingPostgres) {
    console.log("\nGenerated credentials (save securely):");
    console.log(`SEED_ADMIN_PASSWORD=${seedAdminPassword}`);
    console.log(`CRON_SECRET=${cronSecret}`);
    console.log(`AUTH_SECRET=${authSecret}`);
  }

  printDnsRequirements();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});