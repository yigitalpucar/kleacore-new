import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => {
  const at = new Date("2026-09-01T10:00:00Z");
  const calls: Record<string, unknown[]> = {};
  const model = (name: string, rows: unknown) => ({
    findMany: vi.fn(async (args: unknown) => {
      (calls[name] ??= []).push(args);
      return rows;
    }),
  });
  const request: Record<string, unknown> = {};
  return {
    at,
    calls,
    request,
    db: {
      user: {
        findUnique: vi.fn(async (args: unknown) => {
          (calls.user ??= []).push(args);
          return {
            id: "cus-1",
            email: "ayse@example.com",
            name: "Ayşe",
            surname: "Yılmaz",
            phone: "+905551112233",
            address: "Atatürk Cad. 1",
            city: "İstanbul",
            country: "Türkiye",
            balance: "0.00",
            marketingConsent: true,
            marketingConsentAt: at,
            kycStatus: "APPROVED",
            kycSubmittedAt: at,
            kycReviewedAt: at,
            kycRejectionReason: null,
            createdAt: at,
          };
        }),
      },
      order: model("order", [{ orderNumber: "S-2026-000001", status: "COMPLETED", totalAmount: "120.00", taxAmount: "20.00", product: { name: "Hosting S" }, createdAt: at }]),
      invoice: model("invoice", [
        {
          invoiceNumber: "F-2026-000001",
          status: "PAID",
          subtotal: "100.00",
          taxRate: "20.00",
          taxAmount: "20.00",
          totalAmount: "120.00",
          paidAmount: "120.00",
          refundedAmount: "0.00",
          issuedAt: at,
          dueDate: at,
          paidAt: at,
          items: [{ description: "Hosting S, 1 ay" }],
        },
      ]),
      payment: model("payment", [{ amount: "120.00", method: "CREDIT_CARD", status: "COMPLETED", paidAt: at, createdAt: at, invoice: { invoiceNumber: "F-2026-000001" } }]),
      service: model("service", [{ label: "Hosting S", domain: "ornek.com", status: "ACTIVE", amount: "100.00", product: { name: "Hosting S" }, createdAt: at }]),
      domain: model("domain", [{ name: "ornek.com", status: "ACTIVE", whoisName: "Ayşe Yılmaz", whoisAddress: "Atatürk Cad. 1, İstanbul", nameservers: ["ns1.kleacore.com"] }]),
      supportTicket: model("supportTicket", [
        {
          ticketNumber: "T-1",
          subject: "Yardım, \"acil\"",
          status: "CLOSED",
          createdAt: at,
          messages: [{ senderName: "Ayşe", senderRole: "CUSTOMER", message: "Satır 1\nSatır 2, virgül", createdAt: at, files: [{ fileName: "ekran.png" }] }],
        },
      ]),
      consentRecord: model("consentRecord", [
        { documentType: "KVKK_NOTICE", documentVersion: 1, snapshotHash: "abc", ipAddress: "203.0.113.5", acceptedAt: at, order: null },
        { documentType: "MARKETING_CONSENT", documentVersion: 1, snapshotHash: "def", ipAddress: "203.0.113.5", acceptedAt: at, order: null },
      ]),
      loginEvent: model("loginEvent", [{ createdAt: at, success: true, method: "password", ipAddress: "203.0.113.5", uaFamily: "Chrome · macOS" }]),
      kycDocument: model("kycDocument", [{ type: "IDENTITY_FRONT", mimeType: "image/jpeg", sizeBytes: 1024, uploadedAt: at, deleteAfter: null, deletedAt: null }]),
      broadcastRecipient: model("broadcastRecipient", [
        { channel: "EMAIL", to: "ayse@example.com", status: "SENT", sentAt: at, createdAt: at, broadcast: { kind: "MARKETING", subject: "Ekim kampanyası" } },
      ]),
      savedCard: model("savedCard", [{ brand: "VISA", last4: "4242", status: "ACTIVE", consentAt: at, createdAt: at }]),
      dataRequest: {
        findMany: vi.fn(async () => [{ requestNumber: "KVKK-2026-000001", type: "EXPORT", status: "IN_PROGRESS", createdAt: at }]),
        findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
          Object.entries(where).every(([k, v]) => request[k] === v) ? { ...request } : null
        ),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(request, data)),
        updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          if (!Object.entries(where).every(([k, v]) => request[k] === v)) return { count: 0 };
          Object.assign(request, data);
          return { count: 1 };
        }),
      },
    },
  };
});

vi.mock("@/lib/db", () => ({ db: fx.db }));

import { resetStorageDrivers } from "@/lib/storage";
import { EXPORT_SECTION_KEYS, buildExportZip, collectPersonalData, consumeExportDownload, generateDataExport, toCsv } from "./export";
import { hashToken } from "./requests";
import { readZip } from "./zip";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "kc-kvkk-"));
  process.env.STORAGE_LOCAL_DIR = dir;
  delete process.env.STORAGE_DRIVER;
  resetStorageDrivers();
  for (const key of Object.keys(fx.request)) delete fx.request[key];
  Object.assign(fx.request, {
    id: "dr-1",
    requestNumber: "KVKK-2026-000001",
    type: "EXPORT",
    status: "RECEIVED",
    userId: "cus-1",
    exportStorageKey: null,
    exportStorageDriver: null,
    exportTokenHash: null,
    exportExpiresAt: null,
    exportDownloadedAt: null,
  });
});

afterEach(async () => {
  delete process.env.STORAGE_LOCAL_DIR;
  resetStorageDrivers();
  await rm(dir, { recursive: true, force: true });
});

const SECRET_FIELDS = [
  "password",
  "twoFactorSecret",
  "twoFactorBackupCodes",
  "loginTokenNonceHash",
  "panelPassword",
  "moduleData",
  "gatewayData",
  "cardToken",
  "gatewayCustomerRef",
  "keyHash",
  "storageKey",
  "sha256",
];

describe("collectPersonalData", () => {
  it("covers every required area (profile, addresses, orders, invoices, services, domains, tickets, consents, logins)", async () => {
    const sections = await collectPersonalData("cus-1");
    expect(sections.map((s) => s.key)).toEqual([...EXPORT_SECTION_KEYS]);
    const byKey = Object.fromEntries(sections.map((s) => [s.key, s.rows]));
    expect(byKey.profil[0]).toMatchObject({ email: "ayse@example.com", phone: "+905551112233" });
    expect(byKey.adresler).toEqual([
      { tur: "Fatura adresi", adres: "Atatürk Cad. 1", sehir: "İstanbul", ulke: "Türkiye" },
      { tur: "WHOIS iletişim (ornek.com)", adres: "Atatürk Cad. 1, İstanbul", sehir: null, ulke: null },
    ]);
    expect(byKey.siparisler[0]).toMatchObject({ orderNumber: "S-2026-000001", urun: "Hosting S" });
    expect(byKey.faturalar[0]).toMatchObject({ invoiceNumber: "F-2026-000001", totalAmount: "120.00", kalemler: "Hosting S, 1 ay" });
    expect(byKey.hizmetler[0]).toMatchObject({ domain: "ornek.com" });
    expect(byKey["alan-adlari"][0]).toMatchObject({ name: "ornek.com" });
    expect(byKey["destek-talepleri"][0]).toMatchObject({ ticketNumber: "T-1", mesajSayisi: 1 });
    expect(byKey["destek-mesajlari"][0]).toMatchObject({ ticketNumber: "T-1", ekler: "ekran.png" });
    expect(byKey.onaylar[0]).toMatchObject({ documentType: "KVKK_NOTICE" });
    expect(byKey["giris-gecmisi"][0]).toMatchObject({ ipAddress: "203.0.113.5" });
    expect(byKey["kimlik-dogrulama"]).toEqual([
      expect.objectContaining({ kayit: "Durum", kycStatus: "APPROVED" }),
      expect.objectContaining({ kayit: "Belge", type: "IDENTITY_FRONT", sizeBytes: 1024 }),
    ]);
    expect(byKey["ticari-ileti-onayi"]).toEqual([
      { marketingConsent: true, marketingConsentAt: fx.at },
      expect.objectContaining({ kayit: "Onay kaydı", documentType: "MARKETING_CONSENT" }),
    ]);
    expect(byKey["toplu-duyurular"][0]).toMatchObject({ konu: "Ekim kampanyası", status: "SENT" });
  });

  it("never selects secrets (password hash, 2FA, tokens, panel passwords, card tokens)", async () => {
    await collectPersonalData("cus-1");
    const selects = JSON.stringify(fx.calls);
    for (const field of SECRET_FIELDS) expect(selects).not.toContain(`"${field}"`);
  });
});

describe("export zip", () => {
  it("contains a README, the full JSON and one CSV per section", async () => {
    const zip = await buildExportZip("cus-1", "KVKK-2026-000001", fx.at);
    const files = readZip(zip);
    expect([...files.keys()].sort()).toEqual(
      ["BENIOKU.txt", "veriler.json", ...EXPORT_SECTION_KEYS.map((k) => `${k}.csv`)].sort()
    );
    const json = JSON.parse(files.get("veriler.json")!.toString("utf8"));
    expect(Object.keys(json.sections)).toEqual([...EXPORT_SECTION_KEYS]);
    expect(json.requestNumber).toBe("KVKK-2026-000001");
    const csv = files.get("destek-mesajlari.csv")!.toString("utf8");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Satır 1\nSatır 2, virgül"');
  });

  it("CSV escapes quotes, commas and newlines", () => {
    expect(toCsv([{ a: 'x "y"', b: "1,2", c: null }])).toBe('﻿a,b,c\r\n"x ""y""","1,2",\r\n');
  });
});

describe("one-time download link", () => {
  async function prepared() {
    await generateDataExport("dr-1", fx.at);
    expect(fx.request.status).toBe("IN_PROGRESS");
    expect(fx.request.exportStorageKey).toMatch(/^privacy-exports\/\d{4}\/\d{2}\//);
    const token = "download-token-123";
    Object.assign(fx.request, { exportTokenHash: hashToken(token), exportExpiresAt: new Date(Date.now() + 60_000) });
    return token;
  }

  it("downloads exactly once and deletes the stored file", async () => {
    const token = await prepared();
    const key = String(fx.request.exportStorageKey);

    const first = await consumeExportDownload(token);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.fileName).toBe("kvkk-kvkk-2026-000001.zip");
    expect(readZip(first.data).has("veriler.json")).toBe(true);
    expect(fx.request.exportDownloadedAt).toBeInstanceOf(Date);
    expect(fx.request.exportStorageKey).toBeNull();

    const { getStorageDriver } = await import("@/lib/storage");
    expect(await getStorageDriver("local").get(key)).toBeNull();

    expect(await consumeExportDownload(token)).toEqual({ ok: false, reason: "used" });
  });

  it("rejects an expired link, a wrong token and an empty token", async () => {
    const token = await prepared();
    expect(await consumeExportDownload("wrong")).toEqual({ ok: false, reason: "invalid" });
    expect(await consumeExportDownload("")).toEqual({ ok: false, reason: "invalid" });
    fx.request.exportExpiresAt = new Date(Date.now() - 1000);
    expect(await consumeExportDownload(token)).toEqual({ ok: false, reason: "expired" });
  });

  it("only an open EXPORT request linked to an account can be exported", async () => {
    fx.request.type = "ERASURE";
    await expect(generateDataExport("dr-1")).rejects.toThrow("veri kopyası talebi değil");
    fx.request.type = "EXPORT";
    fx.request.userId = null;
    await expect(generateDataExport("dr-1")).rejects.toThrow("hesapla eşleşmiyor");
    fx.request.userId = "cus-1";
    fx.request.status = "COMPLETED";
    await expect(generateDataExport("dr-1")).rejects.toThrow("açık değil");
  });
});
