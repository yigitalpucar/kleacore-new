-- CreateEnum
CREATE TYPE "FraudCheckStatus" AS ENUM ('PASSED', 'REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KycDocumentType" AS ENUM ('IDENTITY_FRONT', 'IDENTITY_BACK', 'TAX_CERTIFICATE', 'SELFIE');

-- AlterEnum
ALTER TYPE "LegalDocumentType" ADD VALUE 'KYC_CONSENT';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "provisioningHeldAt" TIMESTAMP(3),
ADD COLUMN     "provisioningHoldReasons" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "kycRejectionReason" TEXT,
ADD COLUMN     "kycReviewedAt" TIMESTAMP(3),
ADD COLUMN     "kycReviewedBy" TEXT,
ADD COLUMN     "kycStatus" "KycStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "kycSubmittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "fraud_checks" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "threshold" INTEGER NOT NULL,
    "status" "FraudCheckStatus" NOT NULL,
    "paymentBlocked" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB NOT NULL,
    "ipAddress" TEXT,
    "ipCountry" TEXT,
    "ipCountrySource" TEXT,
    "cardCountry" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'checkout',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fraud_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ip_country_ranges" (
    "version" INTEGER NOT NULL,
    "ipFrom" DECIMAL(39,0) NOT NULL,
    "ipTo" DECIMAL(39,0) NOT NULL,
    "country" CHAR(2) NOT NULL,

    CONSTRAINT "ip_country_ranges_pkey" PRIMARY KEY ("version","ipFrom")
);

-- CreateTable
CREATE TABLE "kyc_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "KycDocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageDriver" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleteAfter" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fraud_checks_orderId_key" ON "fraud_checks"("orderId");

-- CreateIndex
CREATE INDEX "fraud_checks_status_createdAt_idx" ON "fraud_checks"("status", "createdAt");

-- CreateIndex
CREATE INDEX "fraud_checks_ipAddress_createdAt_idx" ON "fraud_checks"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "fraud_checks_customerId_idx" ON "fraud_checks"("customerId");

-- CreateIndex
CREATE INDEX "kyc_documents_userId_uploadedAt_idx" ON "kyc_documents"("userId", "uploadedAt");

-- CreateIndex
CREATE INDEX "kyc_documents_deleteAfter_idx" ON "kyc_documents"("deleteAfter");

-- AddForeignKey
ALTER TABLE "fraud_checks" ADD CONSTRAINT "fraud_checks_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
