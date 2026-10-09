import { ProductCategorySlug } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getStorageDriver, type StorageDriver } from "@/lib/storage";
import { getKycConfig, type KycConfig } from "./settings";

const log = createLogger("kyc.retention");

const BATCH = 200;

/**
 * Daily cron (`kyc-retention`): deletes the files of rejected KYC documents
 * whose `deleteAfter` has passed (kyc_rejected_retention_days after the
 * rejection). The row stays as an audit stub with `deletedAt`.
 *
 * Idempotent: the storage delete is idempotent and the row is claimed with a
 * conditional update (deletedAt IS NULL), so a re-run or two overlapping runs
 * never fail and count each document once.
 *
 * Approved documents (no deleteAfter) lose their FILES
 * `kyc_approved_retention_days_after_service_end` (default 730) days after
 * the customer's last KYC-category service ended; customers with any such
 * service still running are never purged. The decision record (kycStatus,
 * kycReviewedAt / kycReviewedBy) and the document rows (deletedAt) stay.
 */
export async function runKycRetention(
  now = new Date(),
  driverFor: (name: string) => StorageDriver = (name) => getStorageDriver(name),
  configLoader: () => Promise<KycConfig> = getKycConfig
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

  const approved = await purgeApprovedDocuments(now, driverFor, await configLoader());
  return { processed: due.length, deleted, failed, approved };
}


const DAY_MS = 24 * 60 * 60 * 1000;
const ENDED_STATUSES = new Set(["CANCELLED", "EXPIRED"]);

interface ServiceEndInput {
  status: string;
  cancelledAt: Date | null;
  expiresAt: Date | null;
  updatedAt: Date;
}

/** Pure: whether any KYC-category service still runs, else when the last one ended. */
export function lastServiceEnd(services: ServiceEndInput[]): { active: boolean; endedAt: Date | null } {
  let endedAt: Date | null = null;
  for (const service of services) {
    if (!ENDED_STATUSES.has(service.status)) return { active: true, endedAt: null };
    const ended = service.cancelledAt ?? service.expiresAt ?? service.updatedAt;
    if (!endedAt || ended > endedAt) endedAt = ended;
  }
  return { active: false, endedAt };
}

/**
 * Pure: until when an approved customer's documents are kept. Anchor: the
 * last KYC-category service end; without any such service (approved but
 * never provisioned) the approval date. Null: keep (a service still runs).
 */
export function approvedRetentionUntil(
  services: ServiceEndInput[],
  approvedAt: Date | null,
  retentionDays: number
): Date | null {
  const { active, endedAt } = lastServiceEnd(services);
  if (active) return null;
  const anchor = endedAt ?? approvedAt;
  return anchor ? new Date(anchor.getTime() + retentionDays * DAY_MS) : null;
}

function categorySlugs(requiredCategories: string[]): ProductCategorySlug[] {
  return requiredCategories.filter((slug): slug is ProductCategorySlug =>
    (Object.values(ProductCategorySlug) as string[]).includes(slug)
  );
}

async function purgeApprovedDocuments(
  now: Date,
  driverFor: (name: string) => StorageDriver,
  config: Pick<KycConfig, "requiredCategories" | "approvedRetentionDaysAfterServiceEnd">
) {
  const slugs = categorySlugs(config.requiredCategories);
  const customers = await db.user.findMany({
    where: { kycStatus: "APPROVED", kycDocuments: { some: { deletedAt: null, deleteAfter: null } } },
    select: {
      id: true,
      kycReviewedAt: true,
      services: {
        where: { product: { category: { slug: { in: slugs } } } },
        select: { status: true, cancelledAt: true, expiresAt: true, updatedAt: true },
      },
      kycDocuments: {
        where: { deletedAt: null, deleteAfter: null },
        select: { id: true, storageDriver: true, storageKey: true },
      },
    },
    take: BATCH,
  });

  let customersPurged = 0;
  let deleted = 0;
  let failed = 0;
  for (const customer of customers) {
    const until = approvedRetentionUntil(customer.services, customer.kycReviewedAt, config.approvedRetentionDaysAfterServiceEnd);
    if (!until || until > now) continue;
    let purgedAny = false;
    for (const document of customer.kycDocuments) {
      try {
        await driverFor(document.storageDriver).delete(document.storageKey);
        const claimed = await db.kycDocument.updateMany({
          where: { id: document.id, deletedAt: null },
          data: { deletedAt: now },
        });
        deleted += claimed.count;
        purgedAny ||= claimed.count > 0;
      } catch (error) {
        failed += 1;
        log.error("approved kyc document could not be deleted; retried next run", { documentId: document.id, error });
      }
    }
    if (purgedAny) customersPurged += 1;
  }
  return { customers: customersPurged, deleted, failed };
}

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
 * KVKK erasure of KYC documents (src/lib/privacy/anonymize.ts), same rule as
 * the retention job: approved documents stay until
 * approvedRetentionDaysAfterServiceEnd after the last KYC-category service
 * ended; pending / rejected documents and deleted stubs go (files + rows).
 */
export async function planKycErasure(
  client: KycErasureClient,
  userId: string,
  config: Pick<KycConfig, "requiredCategories" | "approvedRetentionDaysAfterServiceEnd">,
  now = new Date()
): Promise<KycErasurePlan> {
  const slugs = categorySlugs(config.requiredCategories);
  const [documents, user, serverServices] = await Promise.all([
    client.kycDocument.findMany({
      where: { userId },
      select: { id: true, storageDriver: true, storageKey: true, deletedAt: true, deleteAfter: true },
    }),
    client.user.findUnique({ where: { id: userId }, select: { kycStatus: true, kycReviewedAt: true } }),
    slugs.length > 0
      ? client.service.findMany({
          where: { customerId: userId, product: { category: { slug: { in: slugs } } } },
          select: { status: true, cancelledAt: true, expiresAt: true, updatedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const until =
    user?.kycStatus === "APPROVED"
      ? approvedRetentionUntil(serverServices ?? [], user.kycReviewedAt ?? null, config.approvedRetentionDaysAfterServiceEnd)
      : now;
  // Erasure requires no open services, so `until` is a date here; null (a
  // service still running) keeps the documents too.
  const keepApproved = user?.kycStatus === "APPROVED" && (until === null || until > now);

  const deletable: KycErasurePlan["deletable"] = [];
  let retained = 0;
  for (const doc of documents ?? []) {
    if (keepApproved && !doc.deletedAt && !doc.deleteAfter) retained += 1;
    else deletable.push({ id: doc.id, storageDriver: doc.storageDriver, storageKey: doc.storageKey, deletedAt: doc.deletedAt });
  }
  return { deletable, retained, retainedUntil: retained > 0 ? until : null };
}
