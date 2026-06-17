-- CreateEnum
CREATE TYPE "PlanChangeType" AS ENUM ('UPGRADE', 'DOWNGRADE');

-- CreateEnum
CREATE TYPE "PlanChangeStatus" AS ENUM ('PENDING', 'PAYMENT_PENDING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "service_plan_changes" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fromProductId" TEXT NOT NULL,
    "toProductId" TEXT NOT NULL,
    "type" "PlanChangeType" NOT NULL,
    "status" "PlanChangeStatus" NOT NULL DEFAULT 'PENDING',
    "proratedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orderId" TEXT,
    "invoiceId" TEXT,
    "notes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_plan_changes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "service_plan_changes" ADD CONSTRAINT "service_plan_changes_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_plan_changes" ADD CONSTRAINT "service_plan_changes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_plan_changes" ADD CONSTRAINT "service_plan_changes_fromProductId_fkey" FOREIGN KEY ("fromProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_plan_changes" ADD CONSTRAINT "service_plan_changes_toProductId_fkey" FOREIGN KEY ("toProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_plan_changes" ADD CONSTRAINT "service_plan_changes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;