import type { KycStatus } from "@prisma/client";
import { logActivity } from "@/lib/activity-log";
import { hasPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { getCurrentLegalDocument, recordKvkkAcknowledgement } from "@/lib/legal/documents";
import { createLogger } from "@/lib/logger";
import { releaseHeldOrdersForCustomer } from "@/lib/provisioning/hold";
import { getStorageDriver, isValidStorageKey, type StorageDriver } from "@/lib/storage";
import { contentDisposition } from "@/lib/support/attachments";
import {
  discardKycFiles,
  KYC_DOCUMENT_LABELS,
  storeKycFiles,
  validateKycSubmission,
  type KycFileInput,
} from "./documents";
import { getKycConfig } from "./settings";

const log = createLogger("kyc");

export class KycError extends Error {}

export const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  NONE: "Doğrulanmadı",
  PENDING: "İnceleniyor",
  APPROVED: "Doğrulandı",
  REJECTED: "Reddedildi",
};

/** Statuses from which the customer may (re)submit documents. */
const SUBMITTABLE: KycStatus[] = ["NONE", "REJECTED"];

export interface KycViewer {
  id: string;
  role?: string | null;
}

/** The document's owner, or staff holding kyc.review. */
export function canViewKycDocument(viewer: KycViewer | null | undefined, document: { userId: string }) {
  if (!viewer?.id) return false;
  if (viewer.id === document.userId) return true;
  return hasPermission(viewer.role, "kyc.review");
}

/**
 * Customer upload: validates everything first, stores the files privately,
 * then in one transaction records the documents, the KVKK explicit consent
 * (ConsentRecord, KYC_CONSENT) and moves the customer to PENDING
 * (conditional on NONE/REJECTED, so parallel submissions can't both pass).
 */
export async function submitKycDocuments(input: {
  userId: string;
  files: KycFileInput[];
  consentAccepted: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  driver?: StorageDriver;
}) {
  if (!input.consentAccepted) {
    throw new KycError("Devam etmek için açık rıza metnini onaylamanız gerekiyor.");
  }
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { kycStatus: true, customerType: true, name: true, surname: true, companyName: true },
  });
  if (!user) throw new KycError("Kullanıcı bulunamadı.");
  if (!SUBMITTABLE.includes(user.kycStatus)) {
    throw new KycError(
      user.kycStatus === "PENDING" ? "Belgeleriniz zaten inceleniyor." : "Kimlik doğrulamanız zaten onaylandı."
    );
  }

  const validation = validateKycSubmission(input.files, user.customerType);
  if (!validation.ok) throw new KycError(validation.error);

  const consentDocument = await getCurrentLegalDocument("KYC_CONSENT");
  const driver = input.driver ?? getStorageDriver();
  const stored = await storeKycFiles(validation.files, driver);

  try {
    await db.$transaction(async (tx) => {
      const claimed = await tx.user.updateMany({
        where: { id: input.userId, kycStatus: { in: SUBMITTABLE } },
        data: { kycStatus: "PENDING", kycSubmittedAt: new Date(), kycRejectionReason: null },
      });
      if (claimed.count === 0) throw new KycError("Belgeleriniz zaten inceleniyor.");

      await tx.kycDocument.createMany({
        data: stored.map((file) => ({
          userId: input.userId,
          type: file.type,
          fileName: file.fileName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          sha256: file.sha256,
          storageDriver: file.storageDriver,
          storageKey: file.storageKey,
        })),
      });
      await recordKvkkAcknowledgement(tx, {
        userId: input.userId,
        document: consentDocument,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
      await emitEvent(
        tx,
        "kyc.submitted",
        {
          userId: input.userId,
          customerName: user.companyName || `${user.name} ${user.surname}`.trim(),
          documentTypes: stored.map((file) => KYC_DOCUMENT_LABELS[file.type]),
        },
        { actorId: input.userId }
      );
    });
  } catch (error) {
    await discardKycFiles(stored, driver);
    throw error;
  }

  return { documents: stored.length };
}

export async function approveKyc(input: { userId: string; reviewerId: string }) {
  const claimed = await db.user.updateMany({
    where: { id: input.userId, kycStatus: "PENDING" },
    data: { kycStatus: "APPROVED", kycReviewedAt: new Date(), kycReviewedBy: input.reviewerId, kycRejectionReason: null },
  });
  if (claimed.count === 0) throw new KycError("Bu müşterinin bekleyen bir kimlik doğrulaması yok.");

  // Server orders waiting only for KYC now go to provisioning.
  const { released } = await releaseHeldOrdersForCustomer(input.userId, input.reviewerId);

  await emitEvent(db, "kyc.approved", { userId: input.userId, releasedOrders: released }, { actorId: input.reviewerId });
  await logActivity({
    userId: input.reviewerId,
    action: "KYC_APPROVED",
    entity: "User",
    entityId: input.userId,
    details: { releasedOrders: released },
  });
  return { released };
}

export async function rejectKyc(input: { userId: string; reviewerId: string; reason: string; now?: Date }) {
  const reason = input.reason.trim().slice(0, 500);
  if (reason.length < 3) throw new KycError("Ret nedenini yazın (müşteriye iletilir).");
  const now = input.now ?? new Date();
  const { rejectedRetentionDays } = await getKycConfig();
  const deleteAfter = new Date(now.getTime() + rejectedRetentionDays * 24 * 60 * 60 * 1000);

  await db.$transaction(async (tx) => {
    const claimed = await tx.user.updateMany({
      where: { id: input.userId, kycStatus: "PENDING" },
      data: { kycStatus: "REJECTED", kycReviewedAt: now, kycReviewedBy: input.reviewerId, kycRejectionReason: reason },
    });
    if (claimed.count === 0) throw new KycError("Bu müşterinin bekleyen bir kimlik doğrulaması yok.");

    // The rejected files are deleted by the retention job after the grace period.
    await tx.kycDocument.updateMany({
      where: { userId: input.userId, deletedAt: null, deleteAfter: null },
      data: { deleteAfter },
    });
    await emitEvent(tx, "kyc.rejected", { userId: input.userId, reason }, { actorId: input.reviewerId });
  });

  await logActivity({
    userId: input.reviewerId,
    action: "KYC_REJECTED",
    entity: "User",
    entityId: input.userId,
    details: { reason, deleteAfter: deleteAfter.toISOString() },
  });
  return { deleteAfter };
}

export type KycDownload =
  | { ok: true; body: Buffer; headers: Record<string, string> }
  | { ok: false; status: 401 | 404 | 410 };

/**
 * A KYC document for a viewer: the owner or kyc.review staff; anyone else
 * gets 404 (same as a missing id). Staff views are written to the activity
 * log (KVKK accountability). Images are shown inline (sandboxed), PDFs are
 * downloaded.
 */
export async function loadKycDocumentForViewer(viewer: KycViewer | null | undefined, documentId: string): Promise<KycDownload> {
  if (!viewer?.id) return { ok: false, status: 401 };
  if (!/^[a-z0-9]{10,40}$/i.test(documentId)) return { ok: false, status: 404 };

  const document = await db.kycDocument.findUnique({
    where: { id: documentId },
    select: { id: true, userId: true, type: true, fileName: true, mimeType: true, storageDriver: true, storageKey: true, deletedAt: true },
  });
  if (!document || !canViewKycDocument(viewer, document)) return { ok: false, status: 404 };
  if (document.deletedAt || !isValidStorageKey(document.storageKey)) return { ok: false, status: 410 };

  const body = await getStorageDriver(document.storageDriver).get(document.storageKey);
  if (!body) return { ok: false, status: 410 };

  if (viewer.id !== document.userId) {
    try {
      await logActivity({
        userId: viewer.id,
        action: "KYC_DOCUMENT_VIEWED",
        entity: "User",
        entityId: document.userId,
        details: { documentId: document.id, type: document.type },
      });
    } catch (error) {
      log.warn("kyc view could not be logged", { error });
    }
  }

  const inline = document.mimeType.startsWith("image/");
  return {
    ok: true,
    body,
    headers: {
      "content-type": document.mimeType,
      "content-length": String(body.length),
      "content-disposition": inline ? contentDisposition(document.fileName).replace(/^attachment/, "inline") : contentDisposition(document.fileName),
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "cross-origin-resource-policy": "same-origin",
      "cache-control": "private, no-store",
      "referrer-policy": "no-referrer",
    },
  };
}
