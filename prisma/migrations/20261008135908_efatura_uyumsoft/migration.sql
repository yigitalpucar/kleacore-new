-- AlterEnum
ALTER TYPE "EInvoiceStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "e_invoice_records" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "profile" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerStatus" TEXT,
ADD COLUMN     "statusCheckedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "e_invoice_records_status_idx" ON "e_invoice_records"("status");
