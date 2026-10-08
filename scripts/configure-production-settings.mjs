#!/usr/bin/env node
/**
 * Apply production admin settings (company info, tax, notifications).
 * Idempotent upsert into settings table.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/configure-production-settings.mjs
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const SETTINGS = [
  { key: "company_name", value: "KLEAWORK DIGITAL LLC" },
  { key: "company_email", value: "info@kleacore.com" },
  // No company_phone until a real number exists (contracts/e-mails render
  // none). Address = the company on the site footer (src/lib/company-info.ts)
  // until the Turkish invoicing company is set up.
  { key: "company_address", value: "30 N Gould St Ste R, Sheridan, WY 82801, USA" },
  { key: "tax_rate", value: "20" },
  { key: "currency", value: "TRY" },
  { key: "two_factor", value: "true" },
  { key: "email_notifications", value: "true" },
  { key: "sms_notifications", value: "false" },
  { key: "payment_gateway_provider", value: "iyzico" },
  { key: "registrar_provider", value: "gri" },
  { key: "registrar_enabled", value: "false" },
  { key: "provisioning_enabled", value: "false" },
  { key: "iyzico_enabled", value: "true" },
  { key: "iyzico_test_mode", value: "true" },
];

async function upsertSetting(key, value) {
  await db.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

async function rotateAdminPassword() {
  const newPassword = process.env.NEW_ADMIN_PASSWORD?.trim() ?? randomBytes(18).toString("base64url");
  const admin = await db.user.findFirst({
    where: { email: "admin@kleacore.com", role: "ADMIN" },
    select: { id: true },
  });
  if (!admin) {
    console.log("Admin user not found — skip password rotation");
    return null;
  }
  const hashedPassword = await hash(newPassword, 12);
  await db.user.update({
    where: { id: admin.id },
    data: { password: hashedPassword },
  });
  return newPassword;
}

async function main() {
  console.log("Applying production settings...\n");
  for (const { key, value } of SETTINGS) {
    await upsertSetting(key, value);
    console.log(`  ${key} = ${value}`);
  }

  const newAdminPassword = await rotateAdminPassword();
  if (newAdminPassword) {
    console.log("\nAdmin password rotated for admin@kleacore.com");
    console.log(`NEW_ADMIN_PASSWORD=${newAdminPassword}`);
    console.log("(Remove SEED_ADMIN_PASSWORD from Dokploy env)");
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });