import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { isPositive } from "@/lib/money";
import { getStorageDriver } from "@/lib/storage";
import { getKycConfig } from "@/lib/kyc/settings";
import { KYC_APPROVED_RETENTION_YEARS, planKycErasure } from "@/lib/kyc/retention";
import { LOGIN_EVENT_RETENTION_DAYS } from "./maintenance";
import { DataRequestError } from "./requests";

const log = createLogger("privacy.anonymize");

/**
 * KVKK erasure as a reviewed admin action, never automatic:
 *  1. `previewAnonymization` (dry run) lists blockers, what will be changed
 *     and what is retained and why;
 *  2. `applyAnonymization` re-checks everything inside one transaction and
 *     refuses while any blocker exists.
 *
 * Retained on purpose (legal retention):
 *  - invoices, invoice items, payments, refunds, e-invoice records, balance
 *    transactions and the order amounts — VUK m.253: 10 years. When the
 *    account has invoices, the billing identity printed on them (name,
 *    company, tax number/office, address) stays on the user row as well;
 *  - legal consent records (distance-sales / KVKK acceptance proof);
 *  - the KVKK request itself (proof that it was answered);
 *  - approved KYC documents while the 5651 retention runs (last server
 *    service ended < KYC_APPROVED_RETENTION_YEARS ago, src/lib/kyc/retention.ts);
 *  - sign-in history (security log) until the normal LOGIN_EVENT_RETENTION_DAYS
 *    purge; its e-mail column is anonymised.
 * Staff API tokens the account still owns are revoked.
 * Everything else that identifies the person is deleted or overwritten.
 */

export const REDACTED_TEXT = "[KVKK kapsamında anonimleştirildi]";
const ANONYMOUS_DOMAIN = "anonim.invalid";

type Client = Prisma.TransactionClient | typeof db;

export interface AnonymizationSnapshot {
  user: {
    id: string;
    email: string;
    role: string;
    balance: Prisma.Decimal | string | number;
    alreadyAnonymized: boolean;
  };
  counts: {
    openServices: number;
    unpaidInvoices: number;
    activeDomains: number;
    activeSavedCards: number;
    invoices: number;
    payments: number;
    refunds: number;
    eInvoices: number;
    transactions: number;
    orders: number;
    consents: number;
    tickets: number;
    ticketAttachments: number;
    apiKeys: number;
    sessions: number;
    loginEvents: number;
    trustedDevices: number;
    notifications: number;
    inboxMessages: number;
    notificationLogs: number;
    emailAccounts: number;
    domainsWithWhois: number;
    contactMessages: number;
    activityLogs: number;
    kycDocumentsDeleted: number;
    kycDocumentsRetained: number;
    broadcastRecipients: number;
    staffApiTokens: number;
  };
  /** Approved KYC documents are kept until (null: none retained). */
  kycRetainedUntil?: Date | null;
}

export interface PlanLine {
  label: string;
  count: number;
  detail: string;
}

export interface AnonymizationPlan {
  userId: string;
  email: string;
  canApply: boolean;
  blockers: string[];
  /** Account has invoices: the invoice identity fields stay (VUK). */
  keepBillingIdentity: boolean;
  changes: PlanLine[];
  retained: PlanLine[];
}

export function anonymousEmail(userId: string) {
  return `anonim+${userId.toLowerCase()}@${ANONYMOUS_DOMAIN}`;
}

/** Pure: what an anonymisation would do with this account. */
export function buildAnonymizationPlan(snapshot: AnonymizationSnapshot): AnonymizationPlan {
  const { user, counts: c } = snapshot;
  const blockers: string[] = [];
  if (user.alreadyAnonymized) blockers.push("Hesap zaten anonimleştirilmiş.");
  if (user.role !== "CUSTOMER") blockers.push("Personel hesapları anonimleştirilemez; önce rolü kaldırın.");
  if (c.openServices > 0) blockers.push(`${c.openServices} aktif, askıda veya kurulum bekleyen hizmet var; önce sonlandırılmalı.`);
  if (c.unpaidInvoices > 0) blockers.push(`${c.unpaidInvoices} ödenmemiş fatura var; önce tahsil edilmeli veya iptal edilmeli.`);
  if (c.activeDomains > 0) blockers.push(`${c.activeDomains} aktif / transferdeki alan adı var; önce devredilmeli veya süresi dolmalı.`);
  if (c.activeSavedCards > 0) blockers.push(`${c.activeSavedCards} kayıtlı kart var; önce kart saklama iptal edilmeli.`);
  if (isPositive(user.balance)) blockers.push("Hesapta bakiye var; önce iade edilmeli.");

  const keepBillingIdentity = c.invoices > 0;

  const changes: PlanLine[] = [
    {
      label: "Hesap",
      count: 1,
      detail: keepBillingIdentity
        ? "E-posta, telefon, şifre, 2FA, otomatik ödeme onayı ve IBAN silinir; hesap kapatılır, oturumlar sonlandırılır. Ad, firma, vergi no/dairesi ve adres faturalarda yer aldığı için korunur."
        : "Ad, soyad, e-posta, telefon, firma, vergi bilgileri, adres, şifre ve 2FA silinir; hesap kapatılır, oturumlar sonlandırılır.",
    },
    { label: "Destek talepleri", count: c.tickets, detail: "Konu ve tüm mesaj metinleri anonimleştirilir." },
    { label: "Destek ekleri", count: c.ticketAttachments, detail: "Dosyalar depolamadan ve kayıtlardan silinir." },
    { label: "Kimlik doğrulama belgeleri (KYC)", count: c.kycDocumentsDeleted, detail: "Dosyalar depolamadan, kayıtlar veritabanından silinir." },
    { label: "Toplu duyuru alıcı kayıtları", count: c.broadcastRecipients, detail: "Alıcı e-posta / telefon adresi silinir." },
    { label: "Personel API token'ları", count: c.staffApiTokens, detail: "İptal edilir; son kullanım IP'si silinir." },
    { label: "Hatırlanan cihazlar", count: c.trustedDevices, detail: "Silinir." },
    { label: "API anahtarları", count: c.apiKeys, detail: "Silinir." },
    { label: "Oturum kayıtları", count: c.sessions, detail: "Silinir." },
    { label: "Panel bildirimleri ve gelen kutusu", count: c.notifications + c.inboxMessages, detail: "Silinir." },
    { label: "Bildirim gönderim kayıtları", count: c.notificationLogs, detail: "Alıcı adresi ve şablon verisi silinir." },
    { label: "E-posta hesapları (barındırma)", count: c.emailAccounts, detail: "Kayıtlar silinir." },
    { label: "Alan adı WHOIS bilgileri", count: c.domainsWithWhois, detail: "Ad, e-posta, telefon, adres silinir." },
    { label: "Sipariş notları", count: c.orders, detail: "Müşteri notları silinir; tutarlar korunur." },
    { label: "İletişim formu mesajları", count: c.contactMessages, detail: "Ad, e-posta, telefon ve mesaj silinir." },
    { label: "Aktivite kayıtları", count: c.activityLogs, detail: "IP adresi ve ayrıntılar silinir." },
  ];

  const retained: PlanLine[] = [
    { label: "Faturalar", count: c.invoices, detail: "VUK m.253 gereği 10 yıl saklanır." },
    { label: "Ödemeler ve iadeler", count: c.payments + c.refunds, detail: "Muhasebe kaydı; 10 yıl saklanır." },
    { label: "E-fatura / e-arşiv kayıtları", count: c.eInvoices, detail: "Resmi belge; 10 yıl saklanır." },
    { label: "Bakiye hareketleri", count: c.transactions, detail: "Muhasebe kaydı; 10 yıl saklanır." },
    { label: "Siparişler (tutarlar)", count: c.orders, detail: "Fatura dayanağı; 10 yıl saklanır." },
    { label: "Yasal onay kayıtları", count: c.consents, detail: "Mesafeli sözleşme / KVKK onay ispatı." },
    { label: "KVKK başvurusu", count: 1, detail: "Başvurunun yanıtlandığının ispatı." },
    {
      label: "Giriş geçmişi",
      count: c.loginEvents,
      detail: `Güvenlik kaydı (IP, tarayıcı, zaman); ${LOGIN_EVENT_RETENTION_DAYS} gün sonunda bakım işiyle silinir. E-posta alanı anonimleştirilir.`,
    },
  ];
  if (c.kycDocumentsRetained > 0) {
    const until = snapshot.kycRetainedUntil ? ` (${snapshot.kycRetainedUntil.toISOString().slice(0, 10)} tarihine kadar)` : "";
    retained.push({
      label: "Onaylı kimlik belgeleri (KYC)",
      count: c.kycDocumentsRetained,
      detail: `5651 sayılı Kanun: sunucu hizmetinin bitişinden itibaren ${KYC_APPROVED_RETENTION_YEARS} yıl saklanır${until}; sonra silinir.`,
    });
  }

  return {
    userId: user.id,
    email: user.email,
    canApply: blockers.length === 0,
    blockers,
    keepBillingIdentity,
    changes,
    retained,
  };
}

export async function loadAnonymizationSnapshot(userId: string, client: Client = db, now = new Date()): Promise<AnonymizationSnapshot> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, balance: true },
  });
  if (!user) throw new DataRequestError("NO_USER", "Hesap bulunamadı");

  const ticketWhere = { customerId: userId };
  const kyc = await planKycErasure(client, userId, (await getKycConfig()).requiredCategories, now);
  const [
    openServices,
    unpaidInvoices,
    activeDomains,
    activeSavedCards,
    invoices,
    payments,
    refunds,
    eInvoices,
    transactions,
    orders,
    consents,
    tickets,
    ticketAttachments,
    apiKeys,
    sessions,
    loginEvents,
    trustedDevices,
    notifications,
    inboxMessages,
    notificationLogs,
    emailAccounts,
    domainsWithWhois,
    contactMessages,
    activityLogs,
    broadcastRecipients,
    staffApiTokens,
  ] = await Promise.all([
    client.service.count({ where: { customerId: userId, status: { in: ["PENDING", "ACTIVE", "SUSPENDED"] } } }),
    client.invoice.count({ where: { customerId: userId, status: { in: ["PENDING", "OVERDUE"] } } }),
    client.domain.count({
      where: {
        customerId: userId,
        OR: [{ status: { in: ["ACTIVE", "TRANSFERRING", "PENDING"] } }, { expiresAt: { gt: now }, status: { not: "EXPIRED" } }],
      },
    }),
    client.savedCard.count({ where: { userId, status: { in: ["PENDING", "ACTIVE"] } } }),
    client.invoice.count({ where: { customerId: userId } }),
    client.payment.count({ where: { customerId: userId } }),
    client.refund.count({ where: { invoice: { customerId: userId } } }),
    client.eInvoiceRecord.count({ where: { customerId: userId } }),
    client.transaction.count({ where: { customerId: userId } }),
    client.order.count({ where: { customerId: userId } }),
    client.consentRecord.count({ where: { userId } }),
    client.supportTicket.count({ where: ticketWhere }),
    client.ticketAttachment.count({ where: { ticket: ticketWhere } }),
    client.apiKey.count({ where: { userId } }),
    client.session.count({ where: { userId } }),
    client.loginEvent.count({ where: { userId } }),
    client.trustedDevice.count({ where: { userId } }),
    client.notification.count({ where: { userId } }),
    client.emailMessage.count({ where: { customerId: userId } }),
    client.notificationLog.count({ where: { userId } }),
    client.emailAccount.count({ where: { customerId: userId } }),
    client.domain.count({
      where: {
        customerId: userId,
        OR: [{ whoisName: { not: null } }, { whoisEmail: { not: null } }, { whoisPhone: { not: null } }, { whoisAddress: { not: null } }],
      },
    }),
    client.contactMessage.count({ where: { email: { equals: user.email, mode: "insensitive" } } }),
    client.activityLog.count({ where: { userId } }),
    client.broadcastRecipient.count({ where: { userId } }),
    client.staffApiToken.count({ where: { userId, revokedAt: null } }),
  ]);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      balance: user.balance,
      alreadyAnonymized: user.email.endsWith(`@${ANONYMOUS_DOMAIN}`),
    },
    counts: {
      openServices,
      unpaidInvoices,
      activeDomains,
      activeSavedCards,
      invoices,
      payments,
      refunds,
      eInvoices,
      transactions,
      orders,
      consents,
      tickets,
      ticketAttachments,
      apiKeys,
      sessions,
      loginEvents,
      trustedDevices,
      notifications,
      inboxMessages,
      notificationLogs,
      emailAccounts,
      domainsWithWhois,
      contactMessages,
      activityLogs,
      kycDocumentsDeleted: kyc.deletable.length,
      kycDocumentsRetained: kyc.retained,
      broadcastRecipients,
      staffApiTokens,
    },
    kycRetainedUntil: kyc.retainedUntil,
  };
}

/** Dry run: reads only. */
export async function previewAnonymization(userId: string, now = new Date()) {
  return buildAnonymizationPlan(await loadAnonymizationSnapshot(userId, db, now));
}

async function requireErasureRequest(requestId: string) {
  const request = await db.dataRequest.findUnique({
    where: { id: requestId },
    select: { id: true, type: true, status: true, userId: true, anonymizedAt: true, requestNumber: true },
  });
  if (!request) throw new DataRequestError("NOT_FOUND", "Başvuru bulunamadı");
  if (request.type !== "ERASURE") throw new DataRequestError("NOT_ERASURE", "Bu başvuru silme talebi değil");
  if (request.status !== "RECEIVED" && request.status !== "IN_PROGRESS") {
    throw new DataRequestError("NOT_OPEN", "Başvuru açık değil");
  }
  if (!request.userId) throw new DataRequestError("NO_USER", "Başvuru bir hesapla eşleşmiyor");
  if (request.anonymizedAt) throw new DataRequestError("ALREADY", "Anonimleştirme zaten uygulandı");
  return request as typeof request & { userId: string };
}

export async function previewAnonymizationForRequest(requestId: string, now = new Date()) {
  const request = await requireErasureRequest(requestId);
  return previewAnonymization(request.userId, now);
}

/**
 * Applies the anonymisation for an ERASURE request. `confirmEmail` must be
 * the account's current e-mail (typed by the admin after reading the dry
 * run). Financial and legal records are never touched.
 */
export async function applyAnonymization(
  requestId: string,
  actor: { id: string },
  confirmEmail: string,
  now = new Date()
) {
  const request = await requireErasureRequest(requestId);
  const userId = request.userId;
  const unusablePassword = await hash(randomBytes(32).toString("base64url"), 10);

  const kycConfig = await getKycConfig();
  const { plan, attachmentKeys } = await db.$transaction(
    async (tx) => {
      const snapshot = await loadAnonymizationSnapshot(userId, tx, now);
      const plan = buildAnonymizationPlan(snapshot);
      if (!plan.canApply) throw new DataRequestError("BLOCKED", plan.blockers.join(" "));
      if (confirmEmail.trim().toLowerCase() !== snapshot.user.email.toLowerCase()) {
        throw new DataRequestError("CONFIRM_MISMATCH", "Onay için hesabın e-posta adresini doğru yazın");
      }

      const attachments = (
        (await tx.ticketAttachment.findMany({
          where: { ticket: { customerId: userId } },
          select: { storageKey: true, storageDriver: true },
        })) ?? []
      ).slice();
      // KYC: files of the deletable documents go with the attachments (after commit).
      const kyc = await planKycErasure(tx, userId, kycConfig.requiredCategories, now);
      for (const doc of kyc.deletable) {
        if (!doc.deletedAt) attachments.push({ storageKey: doc.storageKey, storageDriver: doc.storageDriver });
      }
      if (kyc.deletable.length > 0) {
        await tx.kycDocument.deleteMany({ where: { id: { in: kyc.deletable.map((doc) => doc.id) } } });
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          email: anonymousEmail(userId),
          password: unusablePassword,
          phone: null,
          status: "CLOSED",
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: null,
          twoFactorLastUsedStep: null,
          loginTokenNonceHash: null,
          sessionVersion: { increment: 1 },
          affiliatePayoutIban: null,
          autoPayEnabled: false,
          autoPayConsentAt: null,
          autoPayConsentIp: null,
          failedLoginNoticeAt: null,
          marketingConsent: false,
          kycRejectionReason: null,
          emailVerifiedAt: null,
          lastLoginAt: null,
          ...(plan.keepBillingIdentity
            ? {}
            : {
                name: "Anonim",
                surname: "Kullanıcı",
                companyName: null,
                taxNumber: null,
                taxOffice: null,
                address: null,
                city: null,
              }),
        },
      });

      await tx.apiKey.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.emailVerificationToken.deleteMany({ where: { userId } });
      await tx.trustedDevice.deleteMany({ where: { userId } });
      // Kept for the security-log retention; only the typed e-mail goes.
      await tx.loginEvent.updateMany({ where: { userId }, data: { email: anonymousEmail(userId) } });
      await tx.broadcastRecipient.updateMany({ where: { userId }, data: { to: REDACTED_TEXT } });
      await tx.staffApiToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now, revokedById: actor.id },
      });
      await tx.staffApiToken.updateMany({ where: { userId }, data: { lastUsedIp: null } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.emailMessage.deleteMany({ where: { customerId: userId } });
      await tx.emailAccount.deleteMany({ where: { customerId: userId } });
      await tx.notificationLog.updateMany({
        where: { userId },
        data: { to: REDACTED_TEXT, data: {}, redacted: true },
      });
      await tx.ticketAttachment.deleteMany({ where: { ticket: { customerId: userId } } });
      await tx.ticketMessage.updateMany({
        where: { ticket: { customerId: userId } },
        data: { message: REDACTED_TEXT, attachments: [] },
      });
      await tx.ticketMessage.updateMany({
        where: { ticket: { customerId: userId }, senderId: userId },
        data: { senderName: "Anonim" },
      });
      await tx.supportTicket.updateMany({
        where: { customerId: userId },
        data: { subject: REDACTED_TEXT, guestEmail: null, guestName: null },
      });
      await tx.domain.updateMany({
        where: { customerId: userId },
        data: { whoisName: null, whoisEmail: null, whoisPhone: null, whoisAddress: null },
      });
      await tx.order.updateMany({ where: { customerId: userId }, data: { customerNotes: null } });
      await tx.contactMessage.updateMany({
        where: { email: { equals: snapshot.user.email, mode: "insensitive" } },
        data: { name: "Anonim", email: anonymousEmail(userId), phone: null, message: REDACTED_TEXT },
      });
      await tx.activityLog.updateMany({ where: { userId }, data: { ipAddress: null, details: Prisma.DbNull } });

      const summary = {
        appliedAt: now.toISOString(),
        appliedBy: actor.id,
        keepBillingIdentity: plan.keepBillingIdentity,
        changes: plan.changes.map(({ label, count }) => ({ label, count })),
        retained: plan.retained.map(({ label, count }) => ({ label, count })),
      };
      await tx.dataRequest.update({
        where: { id: requestId },
        data: { anonymizedAt: now, anonymizationLog: summary, status: "IN_PROGRESS", handledById: actor.id },
      });
      await tx.activityLog.create({
        data: {
          userId: actor.id,
          action: "privacy.anonymized",
          entity: "DataRequest",
          entityId: requestId,
          details: { requestNumber: request.requestNumber, customerId: userId, ...summary },
        },
      });

      return { plan, attachmentKeys: attachments };
    },
    { timeout: 30_000 }
  );

  for (const file of attachmentKeys) {
    await getStorageDriver(file.storageDriver)
      .delete(file.storageKey)
      .catch((error) => log.warn("attachment object could not be deleted", { error }));
  }

  return plan;
}
