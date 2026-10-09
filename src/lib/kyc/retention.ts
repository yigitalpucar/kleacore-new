import { ProductCategorySlug } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getStorageDriver, type StorageDriver } from "@/lib/storage";

const log = createLogger("kyc.retention");

const BATCH = 200;

/**
 * Daily cron (`kyc-retention`): deletes the files of rejected KYC documents
 * whose `deleteAfter` has passed (kyc_rejected_retention_days after the
 * rejection). The row stays as an audit stub with `deletedAt`.
 *
 * Idempotent: the storage delete is idempotent and the row is claimed with a
 * conditional update (deletedAt IS NULL), so a re-run or two overlapping runs
 * never fail and count each document once. Approved documents have no
 * deleteAfter and are never touched here (docs/fraud-kyc.md: retention).
 */
export async function runKycRetention(
  now = new Date(),
  driverFor: (name: string) => StorageDriver = (name) => getStorageDriver(name)
) {
  const due = await db.kycDocument.findMany({
    where: { deletedAt: null, deleteAfter: { lte: now } },
    select: { id: true, storageDriver: true, storageKey: true },
    orderBy: { deleteAfter: "asc" },
    take: BATCH,
  });

  let deleted = 0;
  let failed = 0;
  for (const document of due) {
    try {
      await driverFor(document.storageDriver).delete(document.storageKey);
      const claimed = await db.kycDocument.updateMany({
        where: { id: document.id, deletedAt: null },
        data: { deletedAt: now },
      });
      deleted += claimed.count;
    } catch (error) {
      failed += 1;
      log.error("kyc document could not be deleted; retried next run", { documentId: document.id, error });
    }
  }

  return { processed: due.length, deleted, failed };
}

/**
 * Approved identity documents of a customer who had a server product are kept
 * this long after the last such service ended (5651: identification of the
 * person a server was provided to; docs/fraud-kyc.md "Saklama"). Owner /
 * legal confirmation of the period is still pending.
 */
export const KYC_APPROVED_RETENTION_YEARS = 2;

type KycErasureClient = {
  kycDocument: Pick<typeof db.kycDocument, "findMany">;
  service: Pick<typeof db.service, "findMany">;
  user: Pick<typeof db.user, "findUnique">;
};

export interface KycErasurePlan {
  /** Documents (files + rows) an erasure deletes. */
  deletable: Array<{ id: string; storageDriver: string; storageKey: string; deletedAt: Date | null }>;
  /** Approved documents kept under the retention rule. */
  retained: number;
  /** Until when the retained documents are kept (null: nothing retained). */
  retainedUntil: Date | null;
}

/**
 * KVKK erasure of KYC documents (src/lib/privacy/anonymize.ts):
 *  - pending / rejected / superseded documents and already-deleted stubs go;
 *  - approved documents (customer kycStatus APPROVED, no deleteAfter) stay
 *    while a service in a KYC category ended less than
 *    KYC_APPROVED_RETENTION_YEARS ago (or has not ended); otherwise they go.
 */
export async function planKycErasure(
  client: KycErasureClient,
  userId: string,
  requiredCategories: string[],
  now = new Date()
): Promise<KycErasurePlan> {
  const slugs = requiredCategories.filter((slug): slug is ProductCategorySlug =>
    (Object.values(ProductCategorySlug) as string[]).includes(slug)
  );
  const [documents, user, serverServices] = await Promise.all([
    client.kycDocument.findMany({
      where: { userId },
      select: { id: true, storageDriver: true, storageKey: true, deletedAt: true, deleteAfter: true },
    }),
    client.user.findUnique({ where: { id: userId }, select: { kycStatus: true } }),
    slugs.length > 0
      ? client.service.findMany({
          where: { customerId: userId, product: { category: { slug: { in: slugs } } } },
          select: { status: true, cancelledAt: true, expiresAt: true, updatedAt: true },
        })
      : Promise.resolve([]),
  ]);
  const docs = documents ?? [];

  let lastServerEnd: Date | null = null;
  for (const service of serverServices ?? []) {
    const ended =
      service.status === "CANCELLED" || service.status === "EXPIRED"
        ? (service.cancelledAt ?? service.expiresAt ?? service.updatedAt)
        : now;
    if (!lastServerEnd || ended > lastServerEnd) lastServerEnd = ended;
  }
  const retainedUntil = lastServerEnd ? new Date(lastServerEnd) : null;
  retainedUntil?.setFullYear(retainedUntil.getFullYear() + KYC_APPROVED_RETENTION_YEARS);
  const keepApproved = user?.kycStatus === "APPROVED" && retainedUntil !== null && retainedUntil > now;

  const deletable: KycErasurePlan["deletable"] = [];
  let retained = 0;
  for (const doc of docs) {
    if (keepApproved && !doc.deletedAt && !doc.deleteAfter) retained += 1;
    else deletable.push({ id: doc.id, storageDriver: doc.storageDriver, storageKey: doc.storageKey, deletedAt: doc.deletedAt });
  }
  return { deletable, retained, retainedUntil: retained > 0 ? retainedUntil : null };
}
