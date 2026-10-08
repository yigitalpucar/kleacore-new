-- AlterTable
ALTER TABLE "services" ADD COLUMN     "panelPassword" TEXT,
ADD COLUMN     "panelPasswordSetAt" TIMESTAMP(3),
ADD COLUMN     "usageSyncedAt" TIMESTAMP(3);
