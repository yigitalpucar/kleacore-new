#!/usr/bin/env node
import "dotenv/config";
import { randomBytes } from "node:crypto";

const DOKPLOY_URL = process.env.DOKPLOY_URL?.replace(/\/$/, "");
const DOKPLOY_API_KEY = process.env.DOKPLOY_API_KEY;
const GIT_REPO =
  process.env.DOKPLOY_GIT_REPO ?? "git@github.com:yigitalpucar/kleacore-new.git";
const GIT_BRANCH = process.env.DOKPLOY_GIT_BRANCH ?? "main";
const GIT_SSH_KEY_ID =
  process.env.DOKPLOY_GIT_SSH_KEY_ID ?? "9H1ZzGL3jeIqCvsqiDWs6";
const APP_DOMAIN = process.env.DOKPLOY_APP_DOMAIN ?? "kleacore.com";

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
    "EMAIL_NOTIFICATIONS=true",
  ].join("\n");
}

async function main() {
  const projects = await apiGet("project.all");
  const existing = projects.find((project) => project.name === "kleacore");

  let projectId;
  let environmentId;

  if (existing) {
    projectId = existing.projectId;
    environmentId = existing.environments[0]?.environmentId;
    console.log(`Using existing project kleacore (${projectId})`);
  } else {
    const project = await api("project.create", {
      name: "kleacore",
      description: "KLEACORE hosting platform",
    });
    projectId = project.projectId;
    environmentId = project.environments?.[0]?.environmentId;
    console.log(`Created project kleacore (${projectId})`);
  }

  if (!environmentId) {
    throw new Error("Could not resolve environmentId for kleacore project");
  }

  const refreshed = await apiGet("project.all");
  const project = refreshed.find((item) => item.projectId === projectId);
  const env = project?.environments?.[0];
  const existingPostgres = env?.postgres?.[0];
  const existingApp = env?.applications?.find((app) => app.name === "kleacore-web");

  let dbPassword = secret(24);
  const authSecret = secret();
  const cronSecret = secret();
  const encryptionKey = secret();
  const seedAdminPassword = secret(18);

  let postgresAppName = "kleacore-postgres";
  let reusingPostgres = false;
  if (!existingPostgres) {
    const postgres = await api("postgres.create", {
      name: "kleacore-postgres",
      appName: "kleacore-postgres",
      databaseName: "kleacore",
      databaseUser: "kleacore",
      databasePassword: dbPassword,
      dockerImage: "postgres:16-alpine",
      environmentId,
      description: "KLEACORE production database",
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
  }

  const databaseUrl = reusingPostgres
    ? process.env.DATABASE_URL
    : `postgresql://kleacore:${dbPassword}@${postgresAppName}:5432/kleacore`;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required when reusing existing postgres");
  }

  let applicationId = existingApp?.applicationId;
  if (!applicationId) {
    const application = await api("application.create", {
      name: "kleacore-web",
      appName: "kleacore-web",
      description: "KLEACORE Next.js application",
      environmentId,
    });
    applicationId = application.applicationId;
    console.log(`Created application kleacore-web (${applicationId})`);
  } else {
    console.log(`Using existing application kleacore-web (${applicationId})`);
  }

  await api("application.saveGitProvider", {
    applicationId,
    customGitUrl: GIT_REPO,
    customGitBranch: GIT_BRANCH,
    customGitBuildPath: "/",
    customGitSSHKeyId: GIT_SSH_KEY_ID,
    enableSubmodules: false,
  });
  console.log("Git provider configured");

  await api("application.saveBuildType", {
    applicationId,
    buildType: "dockerfile",
    dockerfile: "Dockerfile",
    dockerContextPath: null,
    dockerBuildStage: null,
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
  });
  console.log("Environment variables saved");

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
    await api("domain.create", {
      host: `www.${APP_DOMAIN}`,
      applicationId,
      https: true,
      port: 3000,
      path: "/",
      certificateType: "letsencrypt",
      stripPath: false,
    });
    console.log(`Domains configured for ${APP_DOMAIN}`);
  }

  await api("application.deploy", {
    applicationId,
    title: "KLEACORE initial Dokploy deploy",
    description: "Triggered from scripts/dokploy-deploy.mjs",
  });
  console.log("Deployment started");

  if (!reusingPostgres) {
    console.log("\nGenerated credentials (save securely):");
    console.log(`SEED_ADMIN_PASSWORD=${seedAdminPassword}`);
    console.log(`CRON_SECRET=${cronSecret}`);
    console.log(`AUTH_SECRET=${authSecret}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});