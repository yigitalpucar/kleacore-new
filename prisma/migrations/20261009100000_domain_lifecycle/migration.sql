-- Domain lifecycle (roadmap 1.2 + 1.3): renewal periods, expiry notice markers,
-- lifecycle events, registrar sync timestamp. Additive only; safe on live data.

-- CreateEnum
CREATE TYPE "DomainRenewalStatus" AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "domains" ADD COLUMN     "lastSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "domain_renewals" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "years" INTEGER NOT NULL DEFAULT 1,
    "status" "DomainRenewalStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'cron',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "newExpiresAt" TIMESTAMP(3),
    "renewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_renewals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_notices" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_lifecycle_events" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_lifecycle_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "domain_renewals_invoiceId_key" ON "domain_renewals"("invoiceId");

-- CreateIndex
CREATE INDEX "domain_renewals_status_idx" ON "domain_renewals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "domain_renewals_domainId_periodStart_key" ON "domain_renewals"("domainId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "domain_notices_domainId_kind_periodStart_key" ON "domain_notices"("domainId", "kind", "periodStart");

-- CreateIndex
CREATE INDEX "domain_lifecycle_events_domainId_createdAt_idx" ON "domain_lifecycle_events"("domainId", "createdAt");

-- AddForeignKey
ALTER TABLE "domain_renewals" ADD CONSTRAINT "domain_renewals_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_renewals" ADD CONSTRAINT "domain_renewals_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_notices" ADD CONSTRAINT "domain_notices_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_lifecycle_events" ADD CONSTRAINT "domain_lifecycle_events_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
