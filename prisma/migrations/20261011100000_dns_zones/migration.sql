-- Cloudflare DNS (roadmap 2.5): dns_zones + provider columns on dns_records.
-- Additive only: new enum/table, nullable/defaulted columns. Existing dns_records rows get
-- providerRecordId NULL (legacy registrar mode; NULLs don't collide in the unique index),
-- proxied false, managedBy NULL. No setting row is written: dns_default_provider stays
-- "registrar" (current behaviour) until the owner switches it.

-- CreateEnum
CREATE TYPE "DnsZoneStatus" AS ENUM ('PENDING', 'ACTIVE', 'ERROR');

-- AlterEnum
ALTER TYPE "DnsRecordType" ADD VALUE 'CAA';

-- AlterTable
ALTER TABLE "dns_records" ADD COLUMN     "managedBy" TEXT,
ADD COLUMN     "providerRecordId" TEXT,
ADD COLUMN     "proxied" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "dns_zones" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "moduleInstanceId" TEXT,
    "providerZoneId" TEXT NOT NULL,
    "nameservers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "DnsZoneStatus" NOT NULL DEFAULT 'PENDING',
    "providerStatus" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dns_zones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dns_zones_domainId_key" ON "dns_zones"("domainId");

-- CreateIndex
CREATE INDEX "dns_zones_moduleInstanceId_idx" ON "dns_zones"("moduleInstanceId");

-- CreateIndex
CREATE INDEX "dns_zones_status_idx" ON "dns_zones"("status");

-- CreateIndex
CREATE INDEX "dns_records_domainId_idx" ON "dns_records"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "dns_records_domainId_providerRecordId_key" ON "dns_records"("domainId", "providerRecordId");

-- AddForeignKey
ALTER TABLE "dns_zones" ADD CONSTRAINT "dns_zones_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dns_zones" ADD CONSTRAINT "dns_zones_moduleInstanceId_fkey" FOREIGN KEY ("moduleInstanceId") REFERENCES "module_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

