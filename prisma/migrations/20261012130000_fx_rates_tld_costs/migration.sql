-- AlterTable
ALTER TABLE "domain_tlds" ADD COLUMN     "costCurrency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "costRegister" DECIMAL(14,4),
ADD COLUMN     "costRenew" DECIMAL(14,4),
ADD COLUMN     "costTransfer" DECIMAL(14,4),
ADD COLUMN     "costUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "buying" DECIMAL(18,6) NOT NULL,
    "selling" DECIMAL(18,6) NOT NULL,
    "banknoteSelling" DECIMAL(18,6),
    "source" TEXT NOT NULL DEFAULT 'TCMB',
    "bulletinNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_currency_date_key" ON "exchange_rates"("currency", "date");

-- CreateIndex
CREATE INDEX "invoices_status_paidAt_idx" ON "invoices"("status", "paidAt");

-- CreateIndex
CREATE INDEX "payments_status_paidAt_idx" ON "payments"("status", "paidAt");
