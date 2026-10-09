-- CreateEnum
CREATE TYPE "BackupTrigger" AS ENUM ('MANUAL', 'SCHEDULED', 'FINAL');

-- AlterTable
ALTER TABLE "backup_schedules" ADD COLUMN     "hour" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "weekday" INTEGER;

-- AlterTable
ALTER TABLE "backups" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "error" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "moduleInstanceId" TEXT,
ADD COLUMN     "node" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "restoreError" TEXT,
ADD COLUMN     "restoreRequestedAt" TIMESTAMP(3),
ADD COLUMN     "restoreStatus" TEXT,
ADD COLUMN     "restoreTargetId" TEXT,
ADD COLUMN     "restoreUpid" TEXT,
ADD COLUMN     "slotKey" TEXT,
ADD COLUMN     "storage" TEXT,
ADD COLUMN     "trigger" "BackupTrigger" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "upid" TEXT,
ADD COLUMN     "vmid" INTEGER,
ADD COLUMN     "volid" TEXT;

-- CreateIndex
CREATE INDEX "backup_schedules_serviceId_idx" ON "backup_schedules"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "backups_slotKey_key" ON "backups"("slotKey");

-- CreateIndex
CREATE INDEX "backups_serviceId_status_idx" ON "backups"("serviceId", "status");

-- CreateIndex
CREATE INDEX "backups_trigger_expiresAt_idx" ON "backups"("trigger", "expiresAt");


-- Backfill: rows written by a schedule are automatic backups.
UPDATE "backups" SET "trigger" = 'SCHEDULED' WHERE "scheduleId" IS NOT NULL;
