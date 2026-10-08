-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationLogStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- AlterEnum
ALTER TYPE "ProvisioningJobKind" ADD VALUE 'MANUAL';

-- AlterEnum
ALTER TYPE "ServiceStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "provisioning_jobs" ADD COLUMN     "completedBy" TEXT,
ADD COLUMN     "deliveryDetails" JSONB;

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "template" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "status" "NotificationLogStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "providerMessageId" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "redacted" BOOLEAN NOT NULL DEFAULT false,
    "dedupeKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "resendOfId" TEXT,
    "inboxMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_logs_createdAt_idx" ON "notification_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notification_logs_userId_createdAt_idx" ON "notification_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_logs_template_createdAt_idx" ON "notification_logs"("template", "createdAt");

-- CreateIndex
CREATE INDEX "notification_logs_status_createdAt_idx" ON "notification_logs"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_logs_dedupeKey_channel_key" ON "notification_logs"("dedupeKey", "channel");

-- CreateIndex
CREATE INDEX "provisioning_jobs_kind_status_idx" ON "provisioning_jobs"("kind", "status");

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
