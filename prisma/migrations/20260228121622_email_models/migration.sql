-- CreateEnum
CREATE TYPE "EmailMessageCategory" AS ENUM ('BILLING', 'SUPPORT', 'SYSTEM', 'SERVICE', 'SECURITY', 'PROMOTION');

-- CreateEnum
CREATE TYPE "EmailAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateTable
CREATE TABLE "email_accounts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "domainId" TEXT,
    "localPart" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "quotaMb" INTEGER NOT NULL DEFAULT 2048,
    "usedMb" INTEGER NOT NULL DEFAULT 0,
    "status" "EmailAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "forwardTo" TEXT,
    "autoResponder" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "preview" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "category" "EmailMessageCategory" NOT NULL DEFAULT 'SYSTEM',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_accounts_email_key" ON "email_accounts"("email");

-- CreateIndex
CREATE INDEX "email_accounts_customerId_status_idx" ON "email_accounts"("customerId", "status");

-- CreateIndex
CREATE INDEX "email_messages_customerId_sentAt_idx" ON "email_messages"("customerId", "sentAt");

-- AddForeignKey
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
