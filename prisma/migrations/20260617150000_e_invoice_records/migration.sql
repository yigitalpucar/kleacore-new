-- CreateEnum
CREATE TYPE "EInvoiceStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'ACCEPTED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "e_invoice_records" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "EInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "documentUuid" TEXT,
    "documentNumber" TEXT,
    "ublPayload" JSONB,
    "providerResponse" JSONB,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "e_invoice_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "e_invoice_records_invoiceId_key" ON "e_invoice_records"("invoiceId");

-- AddForeignKey
ALTER TABLE "e_invoice_records" ADD CONSTRAINT "e_invoice_records_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;