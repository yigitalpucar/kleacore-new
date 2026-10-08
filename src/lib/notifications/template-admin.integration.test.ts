/**
 * Template overrides against a real Postgres (roadmap 3.2): save → active
 * override used for rendering, version history, revert → TS fallback,
 * restore. Skipped unless RUN_DB_TESTS=1 (local/dev database only):
 *
 *   RUN_DB_TESTS=1 pnpm vitest run src/lib/notifications/template-admin.integration.test.ts
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { loadTemplateOverride } from "./overrides";
import { DEFAULT_BRAND, renderNotification } from "./render";
import {
  restoreTemplateVersion,
  revertTemplateOverride,
  saveTemplateOverride,
  TemplateValidationError,
} from "./template-admin";
import { getTemplate } from "./templates";

const enabled = process.env.RUN_DB_TESTS === "1";
const KEY = "billing.invoice-reminder";
const ctx = { brand: DEFAULT_BRAND, baseUrl: "https://kleacore.test" };

describe.runIf(enabled)("notification template overrides (integration, real Postgres)", () => {
  let adminId = "";

  beforeAll(async () => {
    await db.notificationTemplate.deleteMany({ where: { key: KEY } });
    adminId = (await db.user.findFirstOrThrow({ where: { role: "ADMIN" }, select: { id: true } })).id;
  });

  afterAll(async () => {
    await db.notificationTemplate.deleteMany({ where: { key: KEY } });
  });

  it("validates, saves, versions, reverts to the TS default and restores", async () => {
    const template = getTemplate(KEY);
    const tsSubject = renderNotification(KEY, template.sample, ctx).subject;

    await expect(
      saveTemplateOverride(KEY, "EMAIL", { subject: "{{nope}}", bodyHtml: "<p>x</p>" }, adminId)
    ).rejects.toBeInstanceOf(TemplateValidationError);
    expect(await loadTemplateOverride(KEY)).toBeNull();

    const v1 = await saveTemplateOverride(
      KEY,
      "EMAIL",
      { subject: "Hatırlatma {{invoiceNumber}}", bodyHtml: "<p>{{totalAmount}} — {{dueDate}}</p>", bodyText: "" },
      adminId
    );
    expect(v1).toMatchObject({ version: 1, isActive: true });
    const override = await loadTemplateOverride(KEY);
    expect(renderNotification(KEY, template.sample, ctx, { override }).subject).toBe("Hatırlatma F-2026-000456");

    await saveTemplateOverride(KEY, "EMAIL", { subject: "İkinci {{invoiceNumber}}", bodyHtml: "<p>x</p>", bodyText: "" }, adminId);
    const reverted = await revertTemplateOverride(KEY, "EMAIL", adminId);
    expect(reverted).toMatchObject({ version: 3, isActive: false });
    expect(await loadTemplateOverride(KEY)).toBeNull();
    expect(renderNotification(KEY, template.sample, ctx, { override: await loadTemplateOverride(KEY) }).subject).toBe(tsSubject);

    const versions = await db.notificationTemplateVersion.findMany({
      where: { template: { key: KEY } },
      orderBy: { version: "asc" },
    });
    expect(versions.map((version) => [version.version, version.action])).toEqual([
      [1, "save"],
      [2, "save"],
      [3, "revert"],
    ]);

    const restored = await restoreTemplateVersion(KEY, "EMAIL", versions[0].id, adminId);
    expect(restored).toMatchObject({ version: 4, isActive: true, subject: "Hatırlatma {{invoiceNumber}}" });
  });
});
