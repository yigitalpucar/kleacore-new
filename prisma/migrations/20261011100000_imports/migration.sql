-- Faz 2.7 imports: ImportRun/ImportRow audit tables, Domain.moduleInstanceId and
-- a unique (moduleInstanceId, remoteId) on services so one remote account can never
-- back two services. Safe on live data: new nullable column / new tables; the unique
-- index ignores rows with a NULL instance or remoteId (all pre-2.2 services).

-- CreateEnum
CREATE TYPE "ImportSourceKind" AS ENUM ('WHM', 'PROXMOX', 'REGISTRAR');

-- CreateEnum
CREATE TYPE "ImportRunStatus" AS ENUM ('QUEUED', 'FETCHING', 'READY', 'IMPORTING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'IMPORTED', 'LINKED', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "domains" ADD COLUMN     "moduleInstanceId" TEXT;

-- CreateTable
CREATE TABLE "import_runs" (
    "id" TEXT NOT NULL,
    "source" "ImportSourceKind" NOT NULL,
    "moduleInstanceId" TEXT,
    "instanceLabel" TEXT NOT NULL DEFAULT '',
    "status" "ImportRunStatus" NOT NULL DEFAULT 'QUEUED',
    "createdById" TEXT,
    "appliedById" TEXT,
    "sendInvites" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "linkedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCustomers" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "remoteId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "data" JSONB NOT NULL,
    "proposal" JSONB NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "serviceId" TEXT,
    "domainId" TEXT,
    "customerId" TEXT,
    "createdCustomer" BOOLEAN NOT NULL DEFAULT false,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_runs_createdAt_idx" ON "import_runs"("createdAt");

-- CreateIndex
CREATE INDEX "import_rows_runId_status_idx" ON "import_rows"("runId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "import_rows_runId_remoteId_key" ON "import_rows"("runId", "remoteId");

-- CreateIndex
CREATE INDEX "domains_moduleInstanceId_idx" ON "domains"("moduleInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "services_moduleInstanceId_remoteId_key" ON "services"("moduleInstanceId", "remoteId");

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_moduleInstanceId_fkey" FOREIGN KEY ("moduleInstanceId") REFERENCES "module_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_moduleInstanceId_fkey" FOREIGN KEY ("moduleInstanceId") REFERENCES "module_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_runId_fkey" FOREIGN KEY ("runId") REFERENCES "import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

