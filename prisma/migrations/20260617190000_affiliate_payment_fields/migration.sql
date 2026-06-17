-- AlterTable
ALTER TABLE "affiliate_payments" ADD COLUMN "notes" TEXT;
ALTER TABLE "affiliate_payments" ADD COLUMN "processedBy" TEXT;
ALTER TABLE "affiliate_payments" ADD COLUMN "referralIds" JSONB;