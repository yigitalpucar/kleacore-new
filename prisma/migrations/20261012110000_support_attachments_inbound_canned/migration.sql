-- CreateEnum
CREATE TYPE "TicketSource" AS ENUM ('WEB', 'EMAIL', 'API');

-- CreateEnum
CREATE TYPE "InboundEmailStatus" AS ENUM ('PROCESSED', 'IGNORED', 'FAILED');

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN     "autoCloseWarnedAt" TIMESTAMP(3),
ADD COLUMN     "guestEmail" TEXT,
ADD COLUMN     "guestName" TEXT,
ADD COLUMN     "source" "TicketSource" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "waitingSince" TIMESTAMP(3),
ALTER COLUMN "customerId" DROP NOT NULL;

-- Tickets already answered start their auto-close period at deploy time
-- (not at their last update), so no old ticket is closed without a full
-- waiting period and a warning first.
UPDATE "support_tickets" SET "waitingSince" = NOW() WHERE "status" IN ('ADMIN_REPLY', 'WAITING');

-- AlterTable
ALTER TABLE "ticket_messages" ADD COLUMN     "source" "TicketSource" NOT NULL DEFAULT 'WEB';

-- CreateTable
CREATE TABLE "ticket_attachments" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageDriver" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canned_replies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "department" "TicketDepartment",
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canned_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_mailboxes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 993,
    "secure" BOOLEAN NOT NULL DEFAULT true,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'INBOX',
    "processedFolder" TEXT,
    "department" "TicketDepartment",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastPolledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_mailboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_emails" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "mailboxId" TEXT,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "subject" TEXT NOT NULL,
    "status" "InboundEmailStatus" NOT NULL,
    "reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "ticketId" TEXT,
    "ticketMessageId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_attachments_storageKey_key" ON "ticket_attachments"("storageKey");

-- CreateIndex
CREATE INDEX "ticket_attachments_ticketId_idx" ON "ticket_attachments"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_attachments_messageId_idx" ON "ticket_attachments"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_emails_messageId_key" ON "inbound_emails"("messageId");

-- CreateIndex
CREATE INDEX "inbound_emails_fromAddress_createdAt_idx" ON "inbound_emails"("fromAddress", "createdAt");

-- CreateIndex
CREATE INDEX "inbound_emails_mailboxId_createdAt_idx" ON "inbound_emails"("mailboxId", "createdAt");

-- CreateIndex
CREATE INDEX "support_tickets_status_waitingSince_idx" ON "support_tickets"("status", "waitingSince");

-- CreateIndex
CREATE INDEX "support_tickets_guestEmail_idx" ON "support_tickets"("guestEmail");

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ticket_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "support_mailboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
