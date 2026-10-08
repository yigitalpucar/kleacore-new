-- CreateEnum
CREATE TYPE "SavedCardStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "PaymentAttemptKind" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "autoPayConsentAt" TIMESTAMP(3),
ADD COLUMN     "autoPayConsentIp" TEXT,
ADD COLUMN     "autoPayEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "saved_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "gatewayCustomerRef" TEXT NOT NULL DEFAULT '',
    "cardToken" TEXT NOT NULL DEFAULT '',
    "last4" TEXT NOT NULL DEFAULT '',
    "brand" TEXT NOT NULL DEFAULT '',
    "cardProgram" TEXT,
    "expMonth" INTEGER,
    "expYear" INTEGER,
    "bankName" TEXT,
    "requireCvv" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "SavedCardStatus" NOT NULL DEFAULT 'PENDING',
    "consentAt" TIMESTAMP(3) NOT NULL,
    "consentIp" TEXT,
    "consentUserAgent" TEXT,
    "consentText" TEXT NOT NULL,
    "verificationRef" TEXT,
    "verificationChargedAt" TIMESTAMP(3),
    "verificationRefundedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "expiryNoticeSentAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "kind" "PaymentAttemptKind" NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "savedCardId" TEXT,
    "gateway" TEXT NOT NULL,
    "gatewayRef" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saved_cards_verificationRef_key" ON "saved_cards"("verificationRef");

-- CreateIndex
CREATE INDEX "saved_cards_userId_status_idx" ON "saved_cards"("userId", "status");

-- CreateIndex
CREATE INDEX "saved_cards_status_expYear_expMonth_idx" ON "saved_cards"("status", "expYear", "expMonth");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_idempotencyKey_key" ON "payment_attempts"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_gatewayRef_key" ON "payment_attempts"("gatewayRef");

-- CreateIndex
CREATE INDEX "payment_attempts_invoiceId_kind_status_idx" ON "payment_attempts"("invoiceId", "kind", "status");

-- CreateIndex
CREATE INDEX "payment_attempts_userId_createdAt_idx" ON "payment_attempts"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_savedCardId_fkey" FOREIGN KEY ("savedCardId") REFERENCES "saved_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

