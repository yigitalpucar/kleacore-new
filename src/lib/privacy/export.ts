import { db } from "@/lib/db";
import { generateStorageKey, getStorageDriver } from "@/lib/storage";
import { DataRequestError, hashToken } from "./requests";
import { createZip } from "./zip";

/**
 * KVKK "verilerimin bir kopyası": every personal-data area of one account as
 * JSON (one file, all sections) plus one CSV per section, zipped and stored
 * through the storage layer. Secrets are never exported (password hash, 2FA
 * secret / backup codes, login nonces, API key hashes, panel passwords,
 * module state, card tokens, gateway payloads).
 */

type Row = Record<string, unknown>;

export interface PersonalDataSection {
  /** File base name (ASCII). */
  key: string;
  title: string;
  rows: Row[];
}

/** Sections every export contains (an empty section still gets its file). */
export const EXPORT_SECTION_KEYS = [
  "profil",
  "adresler",
  "siparisler",
  "faturalar",
  "odemeler",
  "hizmetler",
  "alan-adlari",
  "destek-talepleri",
  "destek-mesajlari",
  "onaylar",
  "giris-gecmisi",
  "kayitli-kartlar",
  "kvkk-basvurulari",
] as const;

const str = (value: unknown) => (value === null || value === undefined ? null : String(value));

export async function collectPersonalData(userId: string): Promise<PersonalDataSection[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      surname: true,
      phone: true,
      role: true,
      status: true,
      customerType: true,
      companyName: true,
      taxNumber: true,
      taxOffice: true,
      address: true,
      city: true,
      country: true,
      twoFactorEnabled: true,
      balance: true,
      affiliateCode: true,
      autoPayEnabled: true,
      autoPayConsentAt: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) throw new DataRequestError("NO_USER", "Hesap bulunamadı");

  const [orders, invoices, payments, services, domains, tickets, consents, logins, cards, requests] = await Promise.all([
    db.order.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "asc" },
      select: {
        orderNumber: true,
        status: true,
        domain: true,
        billingPeriod: true,
        quantity: true,
        totalAmount: true,
        taxAmount: true,
        customerNotes: true,
        createdAt: true,
        completedAt: true,
        cancelledAt: true,
        product: { select: { name: true } },
      },
    }),
    db.invoice.findMany({
      where: { customerId: userId },
      orderBy: { issuedAt: "asc" },
      select: {
        invoiceNumber: true,
        status: true,
        subtotal: true,
        taxRate: true,
        taxAmount: true,
        totalAmount: true,
        paidAmount: true,
        refundedAmount: true,
        issuedAt: true,
        dueDate: true,
        paidAt: true,
        items: { select: { description: true } },
      },
    }),
    db.payment.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "asc" },
      select: {
        amount: true,
        method: true,
        status: true,
        paidAt: true,
        createdAt: true,
        invoice: { select: { invoiceNumber: true } },
      },
    }),
    db.service.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "asc" },
      select: {
        label: true,
        domain: true,
        username: true,
        ipAddress: true,
        status: true,
        billingPeriod: true,
        amount: true,
        nextDueDate: true,
        expiresAt: true,
        createdAt: true,
        cancelledAt: true,
        product: { select: { name: true } },
      },
    }),
    db.domain.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "asc" },
      select: {
        name: true,
        status: true,
        registeredAt: true,
        expiresAt: true,
        autoRenew: true,
        privacyEnabled: true,
        nameservers: true,
        whoisName: true,
        whoisEmail: true,
        whoisPhone: true,
        whoisAddress: true,
      },
    }),
    db.supportTicket.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "asc" },
      select: {
        ticketNumber: true,
        subject: true,
        department: true,
        status: true,
        createdAt: true,
        closedAt: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: { senderName: true, senderRole: true, message: true, createdAt: true, files: { select: { fileName: true } } },
        },
      },
    }),
    db.consentRecord.findMany({
      where: { userId },
      orderBy: { acceptedAt: "asc" },
      select: {
        documentType: true,
        documentVersion: true,
        snapshotHash: true,
        ipAddress: true,
        userAgent: true,
        acceptedAt: true,
        order: { select: { orderNumber: true } },
      },
    }),
    db.loginEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, success: true, reason: true, method: true, twoFactorUsed: true, ipAddress: true, uaFamily: true, userAgent: true },
    }),
    db.savedCard.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { brand: true, last4: true, expMonth: true, expYear: true, bankName: true, status: true, consentAt: true, consentIp: true, createdAt: true },
    }),
    db.dataRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { requestNumber: true, type: true, status: true, createdAt: true, receivedAt: true, completedAt: true },
    }),
  ]);

  return [
    {
      key: "profil",
      title: "Profil",
      rows: [
        {
          ...user,
          balance: str(user.balance),
        },
      ],
    },
    {
      key: "adresler",
      title: "Adresler",
      rows: [
        { tur: "Fatura adresi", adres: user.address, sehir: user.city, ulke: user.country },
        ...domains
          .filter((d) => d.whoisAddress || d.whoisName || d.whoisEmail || d.whoisPhone)
          .map((d) => ({ tur: `WHOIS iletişim (${d.name})`, adres: d.whoisAddress, sehir: null, ulke: null })),
      ],
    },
    {
      key: "siparisler",
      title: "Siparişler",
      rows: orders.map(({ product, totalAmount, taxAmount, ...o }) => ({
        ...o,
        urun: product?.name ?? null,
        totalAmount: str(totalAmount),
        taxAmount: str(taxAmount),
      })),
    },
    {
      key: "faturalar",
      title: "Faturalar (üst veri)",
      rows: invoices.map(({ items, subtotal, taxRate, taxAmount, totalAmount, paidAmount, refundedAmount, ...i }) => ({
        ...i,
        subtotal: str(subtotal),
        taxRate: str(taxRate),
        taxAmount: str(taxAmount),
        totalAmount: str(totalAmount),
        paidAmount: str(paidAmount),
        refundedAmount: str(refundedAmount),
        kalemler: items.map((item) => item.description).join(" | "),
      })),
    },
    {
      key: "odemeler",
      title: "Ödemeler",
      rows: payments.map(({ invoice, amount, ...p }) => ({ ...p, amount: str(amount), invoiceNumber: invoice.invoiceNumber })),
    },
    {
      key: "hizmetler",
      title: "Hizmetler",
      rows: services.map(({ product, amount, ...s }) => ({ ...s, urun: product?.name ?? null, amount: str(amount) })),
    },
    { key: "alan-adlari", title: "Alan adları", rows: domains },
    {
      key: "destek-talepleri",
      title: "Destek talepleri",
      rows: tickets.map(({ messages, ...t }) => ({ ...t, mesajSayisi: messages.length })),
    },
    {
      key: "destek-mesajlari",
      title: "Destek mesajları",
      rows: tickets.flatMap((t) =>
        t.messages.map(({ files, ...m }) => ({ ticketNumber: t.ticketNumber, ...m, ekler: files.map((f) => f.fileName).join(" | ") }))
      ),
    },
    {
      key: "onaylar",
      title: "Yasal onaylar",
      rows: consents.map(({ order, ...c }) => ({ ...c, orderNumber: order?.orderNumber ?? null })),
    },
    { key: "giris-gecmisi", title: "Giriş geçmişi", rows: logins },
    { key: "kayitli-kartlar", title: "Kayıtlı kartlar (maskeli)", rows: cards },
    { key: "kvkk-basvurulari", title: "KVKK başvuruları", rows: requests },
  ];
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text =
    value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV with a UTF-8 BOM (Excel shows Turkish characters correctly). */
export function toCsv(rows: Row[]): string {
  const columns: string[] = [];
  for (const row of rows) for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  const lines = [columns.map(cell).join(","), ...rows.map((row) => columns.map((c) => cell(row[c])).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

const README = (requestNumber: string, generatedAt: Date) =>
  [
    `KVKK veri kopyası — başvuru ${requestNumber}`,
    `Oluşturulma: ${generatedAt.toISOString()}`,
    "",
    "veriler.json   Tüm bölümler tek dosyada (makine tarafından okunabilir).",
    "*.csv          Her bölüm ayrı tablo (Excel / LibreOffice ile açılabilir).",
    "",
    "Güvenlik nedeniyle şifre özetleri, iki faktörlü doğrulama anahtarları, API anahtarları,",
    "kart saklama anahtarları ve hizmet şifreleri dosyaya eklenmemiştir.",
    "",
  ].join("\r\n");

export async function buildExportZip(userId: string, requestNumber: string, now = new Date()) {
  const sections = await collectPersonalData(userId);
  const json = JSON.stringify(
    {
      requestNumber,
      generatedAt: now.toISOString(),
      sections: Object.fromEntries(sections.map((s) => [s.key, { title: s.title, rows: s.rows }])),
    },
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  );
  return createZip(
    [
      { name: "BENIOKU.txt", data: README(requestNumber, now) },
      { name: "veriler.json", data: json },
      ...sections.map((s) => ({ name: `${s.key}.csv`, data: toCsv(s.rows) })),
    ],
    now
  );
}

/**
 * Builds the export of an EXPORT request's account and stores it (replacing a
 * previous, undelivered one). The download link is issued when the admin
 * sends the response (respondToDataRequest).
 */
export async function generateDataExport(requestId: string, now = new Date()) {
  const request = await db.dataRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new DataRequestError("NOT_FOUND", "Başvuru bulunamadı");
  if (request.type !== "EXPORT") throw new DataRequestError("NOT_EXPORT", "Bu başvuru veri kopyası talebi değil");
  if (request.status !== "RECEIVED" && request.status !== "IN_PROGRESS") {
    throw new DataRequestError("NOT_OPEN", "Başvuru açık değil");
  }
  if (!request.userId) throw new DataRequestError("NO_USER", "Başvuru bir hesapla eşleşmiyor");

  const zip = await buildExportZip(request.userId, request.requestNumber, now);
  const driver = getStorageDriver();
  const key = generateStorageKey("privacy-exports", now);
  await driver.put(key, zip, { contentType: "application/zip" });

  const previous = request.exportStorageKey ? { key: request.exportStorageKey, driver: request.exportStorageDriver } : null;
  await db.dataRequest.update({
    where: { id: requestId },
    data: {
      exportStorageDriver: driver.name,
      exportStorageKey: key,
      exportSizeBytes: zip.length,
      exportCreatedAt: now,
      exportTokenHash: null,
      exportExpiresAt: null,
      exportDownloadedAt: null,
      status: "IN_PROGRESS",
    },
  });
  if (previous) await getStorageDriver(previous.driver ?? undefined).delete(previous.key).catch(() => undefined);
  return { sizeBytes: zip.length };
}

export type ExportDownload =
  | { ok: true; fileName: string; data: Buffer }
  | { ok: false; reason: "invalid" | "expired" | "used" | "missing" };

/**
 * One-time download: the token must match, be unexpired and unused. The row
 * is claimed atomically (a second click gets "used"); the object is deleted
 * from storage right after it was read.
 */
export async function consumeExportDownload(token: string, now = new Date()): Promise<ExportDownload> {
  if (!token || token.length > 200) return { ok: false, reason: "invalid" };
  const tokenHash = hashToken(token);
  const request = await db.dataRequest.findUnique({ where: { exportTokenHash: tokenHash } });
  if (!request) return { ok: false, reason: "invalid" };
  if (request.exportDownloadedAt) return { ok: false, reason: "used" };
  if (!request.exportStorageKey) return { ok: false, reason: "expired" };
  if (!request.exportExpiresAt || request.exportExpiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };

  const driver = getStorageDriver(request.exportStorageDriver ?? undefined);
  const data = await driver.get(request.exportStorageKey);
  if (!data) return { ok: false, reason: "missing" };

  const { count } = await db.dataRequest.updateMany({
    where: { id: request.id, exportTokenHash: tokenHash, exportDownloadedAt: null },
    // The token hash stays, so a second click is answered with "used".
    data: { exportDownloadedAt: now, exportStorageKey: null },
  });
  if (count !== 1) return { ok: false, reason: "used" };

  await driver.delete(request.exportStorageKey).catch(() => undefined);
  return { ok: true, fileName: `kvkk-${request.requestNumber.toLowerCase()}.zip`, data };
}

/** Removes stored exports whose link expired unused (daily maintenance). */
export async function purgeExpiredExports(now = new Date()) {
  const stale = await db.dataRequest.findMany({
    where: {
      exportStorageKey: { not: null },
      OR: [
        { exportExpiresAt: { lte: now } },
        // Built but never sent: drop after 30 days.
        { exportExpiresAt: null, exportCreatedAt: { lte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
      ],
    },
    select: { id: true, exportStorageKey: true, exportStorageDriver: true },
  });
  for (const row of stale) {
    if (!row.exportStorageKey) continue;
    await getStorageDriver(row.exportStorageDriver ?? undefined).delete(row.exportStorageKey).catch(() => undefined);
    await db.dataRequest.update({
      where: { id: row.id },
      // Token hash kept: the link now answers "expired".
      data: { exportStorageKey: null },
    });
  }
  return stale.length;
}
