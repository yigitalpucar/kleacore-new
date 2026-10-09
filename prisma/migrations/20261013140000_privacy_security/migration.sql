-- CreateEnum
CREATE TYPE "DataRequestType" AS ENUM ('INFORMATION', 'EXPORT', 'RECTIFICATION', 'ERASURE', 'OBJECTION');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('PENDING_VERIFICATION', 'RECEIVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failedLoginNoticeAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "login_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "method" TEXT,
    "twoFactorUsed" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "uaFamily" TEXT,
    "network" TEXT,
    "deviceHash" TEXT,
    "newDevice" BOOLEAN NOT NULL DEFAULT false,
    "sessionVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ipAddress" TEXT,
    "sessionVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_requests" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "type" "DataRequestType" NOT NULL,
    "status" "DataRequestStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "details" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "verificationTokenHash" TEXT,
    "verificationExpiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "responseText" TEXT,
    "respondedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "handledById" TEXT,
    "exportStorageDriver" TEXT,
    "exportStorageKey" TEXT,
    "exportSizeBytes" INTEGER,
    "exportCreatedAt" TIMESTAMP(3),
    "exportTokenHash" TEXT,
    "exportExpiresAt" TIMESTAMP(3),
    "exportDownloadedAt" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "anonymizationLog" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_request_notes" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_request_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_events_userId_createdAt_idx" ON "login_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "login_events_userId_deviceHash_idx" ON "login_events"("userId", "deviceHash");

-- CreateIndex
CREATE INDEX "login_events_createdAt_idx" ON "login_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_secretHash_key" ON "trusted_devices"("secretHash");

-- CreateIndex
CREATE INDEX "trusted_devices_userId_expiresAt_idx" ON "trusted_devices"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "data_requests_requestNumber_key" ON "data_requests"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "data_requests_verificationTokenHash_key" ON "data_requests"("verificationTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "data_requests_exportStorageKey_key" ON "data_requests"("exportStorageKey");

-- CreateIndex
CREATE UNIQUE INDEX "data_requests_exportTokenHash_key" ON "data_requests"("exportTokenHash");

-- CreateIndex
CREATE INDEX "data_requests_status_dueAt_idx" ON "data_requests"("status", "dueAt");

-- CreateIndex
CREATE INDEX "data_requests_userId_idx" ON "data_requests"("userId");

-- CreateIndex
CREATE INDEX "data_requests_email_idx" ON "data_requests"("email");

-- CreateIndex
CREATE INDEX "data_request_notes_requestId_createdAt_idx" ON "data_request_notes"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_request_notes" ADD CONSTRAINT "data_request_notes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "data_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
