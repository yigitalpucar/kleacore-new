-- CreateEnum
CREATE TYPE "ModuleKind" AS ENUM ('payment', 'registrar', 'server', 'dns', 'sms', 'mail', 'einvoice', 'storage');

-- CreateEnum
CREATE TYPE "ModuleHealthStatus" AS ENUM ('UNKNOWN', 'OK', 'ERROR');

-- CreateEnum
CREATE TYPE "IpAddressStatus" AS ENUM ('FREE', 'ASSIGNED', 'RESERVED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "moduleInstanceId" TEXT,
ADD COLUMN     "moduleOptions" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "servers" ADD COLUMN     "moduleInstanceId" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "moduleInstanceId" TEXT,
ADD COLUMN     "remoteId" TEXT;

-- CreateTable
CREATE TABLE "module_instances" (
    "id" TEXT NOT NULL,
    "kind" "ModuleKind" NOT NULL,
    "moduleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "groupKey" TEXT,
    "capacity" INTEGER,
    "legacySource" TEXT,
    "lastHealthAt" TIMESTAMP(3),
    "lastHealthStatus" "ModuleHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastHealthError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ip_pools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cidr" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "prefix" INTEGER NOT NULL,
    "netmask" TEXT NOT NULL,
    "dnsServers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "vlan" INTEGER,
    "moduleInstanceId" TEXT,
    "releaseCooldownMinutes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ip_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ip_addresses" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "sortKey" BIGINT NOT NULL,
    "status" "IpAddressStatus" NOT NULL DEFAULT 'FREE',
    "serviceId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "cooldownUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ip_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "module_instances_legacySource_key" ON "module_instances"("legacySource");

-- CreateIndex
CREATE INDEX "module_instances_kind_isActive_idx" ON "module_instances"("kind", "isActive");

-- CreateIndex
CREATE INDEX "module_instances_moduleId_idx" ON "module_instances"("moduleId");

-- CreateIndex
CREATE INDEX "ip_pools_moduleInstanceId_idx" ON "ip_pools"("moduleInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ip_addresses_address_key" ON "ip_addresses"("address");

-- CreateIndex
CREATE INDEX "ip_addresses_poolId_status_sortKey_idx" ON "ip_addresses"("poolId", "status", "sortKey");

-- CreateIndex
CREATE INDEX "ip_addresses_serviceId_idx" ON "ip_addresses"("serviceId");

-- CreateIndex
CREATE INDEX "products_moduleInstanceId_idx" ON "products"("moduleInstanceId");

-- CreateIndex
CREATE INDEX "servers_moduleInstanceId_idx" ON "servers"("moduleInstanceId");

-- CreateIndex
CREATE INDEX "services_moduleInstanceId_idx" ON "services"("moduleInstanceId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_moduleInstanceId_fkey" FOREIGN KEY ("moduleInstanceId") REFERENCES "module_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_moduleInstanceId_fkey" FOREIGN KEY ("moduleInstanceId") REFERENCES "module_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_moduleInstanceId_fkey" FOREIGN KEY ("moduleInstanceId") REFERENCES "module_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ip_pools" ADD CONSTRAINT "ip_pools_moduleInstanceId_fkey" FOREIGN KEY ("moduleInstanceId") REFERENCES "module_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ip_addresses" ADD CONSTRAINT "ip_addresses_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "ip_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ip_addresses" ADD CONSTRAINT "ip_addresses_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
