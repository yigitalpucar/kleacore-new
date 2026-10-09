/**
 * KVKK requests against a real Postgres (migration + queries):
 * panel EXPORT → export zip in storage → response with one-time link →
 * one download; ERASURE dry run vs apply with a paid invoice kept intact.
 *
 * Skipped unless RUN_DB_TESTS=1; uses DATABASE_URL from .env (local copy only):
 *   RUN_DB_TESTS=1 pnpm vitest run src/lib/privacy/privacy.integration.test.ts
 */
import "dotenv/config";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { resetStorageDrivers } from "@/lib/storage";
import { anonymousEmail, applyAnonymization, previewAnonymizationForRequest } from "./anonymize";
import { consumeExportDownload, generateDataExport } from "./export";
import { createPanelDataRequest, respondToDataRequest } from "./requests";
import { readZip } from "./zip";

const enabled = process.env.RUN_DB_TESTS === "1";
const actor = { id: "", name: "Test admin" };

describe.runIf(enabled)("KVKK requests (integration, real Postgres)", () => {
  const suffix = Date.now().toString(36);
  const userIds: string[] = [];
  let storageDir = "";
  let customerId = "";
  let invoiceId = "";

  beforeAll(async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    storageDir = await mkdtemp(path.join(tmpdir(), "kc-kvkk-int-"));
    process.env.STORAGE_LOCAL_DIR = storageDir;
    process.env.STORAGE_DRIVER = "local";
    resetStorageDrivers();

    const admin = await db.user.findFirstOrThrow({ where: { role: "ADMIN" }, select: { id: true } });
    actor.id = admin.id;
    const customer = await db.user.create({
      data: {
        email: `kvkk-${suffix}@test.local`,
        password: "x",
        name: "Kvkk",
        surname: "Deneme",
        phone: "+905550000000",
        taxNumber: "11111111111",
        address: "Test Sok. 1",
      },
    });
    customerId = customer.id;
    userIds.push(customer.id);
    const invoice = await db.invoice.create({
      data: {
        invoiceNumber: `KVKKTEST-${suffix}`,
        customerId,
        subtotal: "100.00",
        taxAmount: "20.00",
        totalAmount: "120.00",
        paidAmount: "120.00",
        status: "PAID",
        dueDate: new Date(),
        paidAt: new Date(),
      },
    });
    invoiceId = invoice.id;
    await db.loginEvent.create({ data: { userId: customerId, email: customer.email, success: true, ipAddress: "203.0.113.5" } });
  });

  afterAll(async () => {
    const requests = await db.dataRequest.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
    const aggregateIds = [...requests.map((r) => r.id), ...userIds];
    await db.notificationLog.deleteMany({ where: { userId: { in: userIds } } });
    await db.domainEvent.deleteMany({ where: { aggregateId: { in: aggregateIds } } });
    await db.dataRequest.deleteMany({ where: { id: { in: requests.map((r) => r.id) } } });
    await db.activityLog.deleteMany({ where: { action: "privacy.anonymized", entityId: { in: requests.map((r) => r.id) } } });
    await db.invoice.deleteMany({ where: { id: invoiceId } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    delete process.env.STORAGE_LOCAL_DIR;
    delete process.env.STORAGE_DRIVER;
    resetStorageDrivers();
    await rm(storageDir, { recursive: true, force: true });
  });

  it("export: prepared once, downloaded once", async () => {
    const request = await createPanelDataRequest(customerId, { type: "EXPORT", details: "Verilerimin kopyası lütfen." });
    expect(request.dueAt!.getTime() - request.receivedAt!.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect(await db.domainEvent.count({ where: { type: "privacy.request_received", aggregateId: request.id } })).toBe(1);

    await generateDataExport(request.id);
    await respondToDataRequest(request.id, { outcome: "COMPLETED", responseText: "Veri kopyanız hazırdır." }, actor);

    const event = await db.domainEvent.findFirstOrThrow({ where: { type: "privacy.request_completed", aggregateId: request.id } });
    const payload = event.payload as Record<string, string>;
    // The link is a secret: stored encrypted in the outbox.
    expect(payload.downloadUrl.startsWith("enc:")).toBe(true);

    const { decryptSecret } = await import("@/lib/secrets/crypto");
    const token = new URL(decryptSecret(payload.downloadUrl)).searchParams.get("token")!;
    const first = await consumeExportDownload(token);
    expect(first.ok).toBe(true);
    if (first.ok) {
      const files = readZip(first.data);
      const json = JSON.parse(files.get("veriler.json")!.toString("utf8"));
      expect(json.sections.profil.rows[0].email).toBe(`kvkk-${suffix}@test.local`);
      expect(json.sections.faturalar.rows[0].invoiceNumber).toBe(`KVKKTEST-${suffix}`);
      expect(json.sections["giris-gecmisi"].rows).toHaveLength(1);
      expect(files.get("veriler.json")!.toString("utf8")).not.toContain('"password"');
    }
    expect(await consumeExportDownload(token)).toEqual({ ok: false, reason: "used" });
  });

  it("erasure: dry run writes nothing, apply anonymises and keeps the invoice", async () => {
    const request = await createPanelDataRequest(customerId, { type: "ERASURE", details: "Hesabımı silin lütfen." });
    const before = await db.user.findUniqueOrThrow({ where: { id: customerId } });

    const plan = await previewAnonymizationForRequest(request.id);
    expect(plan.canApply).toBe(true);
    expect(plan.keepBillingIdentity).toBe(true);
    expect(await db.user.findUniqueOrThrow({ where: { id: customerId } })).toEqual(before);

    await applyAnonymization(request.id, actor, before.email);

    const after = await db.user.findUniqueOrThrow({ where: { id: customerId } });
    expect(after).toMatchObject({
      email: anonymousEmail(customerId),
      phone: null,
      status: "CLOSED",
      name: "Kvkk",
      taxNumber: "11111111111",
      address: "Test Sok. 1",
      sessionVersion: before.sessionVersion + 1,
    });
    expect(await db.loginEvent.count({ where: { userId: customerId } })).toBe(0);
    const invoice = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice).toMatchObject({ invoiceNumber: `KVKKTEST-${suffix}`, status: "PAID", customerId });
    expect(invoice.totalAmount.toFixed(2)).toBe("120.00");

    await respondToDataRequest(request.id, { outcome: "COMPLETED", responseText: "Verileriniz anonimleştirildi." }, actor);
    expect((await db.dataRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("COMPLETED");
    await expect(applyAnonymization(request.id, actor, anonymousEmail(customerId))).rejects.toThrow();
  });
});
