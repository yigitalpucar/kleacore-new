-- AlterTable
ALTER TABLE "email_accounts" ADD COLUMN "serviceId" TEXT;

-- CreateIndex
CREATE INDEX "email_accounts_serviceId_idx" ON "email_accounts"("serviceId");

-- AddForeignKey
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;