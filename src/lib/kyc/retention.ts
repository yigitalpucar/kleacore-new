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
