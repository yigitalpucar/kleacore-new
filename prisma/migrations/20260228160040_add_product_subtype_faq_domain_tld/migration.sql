-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductCategorySlug" ADD VALUE 'cloud';
ALTER TYPE "ProductCategorySlug" ADD VALUE 'datacenter';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "faq" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "subType" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "domain_tlds" (
    "id" TEXT NOT NULL,
    "ext" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "registerPrice" DOUBLE PRECISION NOT NULL,
    "renewPrice" DOUBLE PRECISION NOT NULL,
    "transferPrice" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_tlds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "domain_tlds_ext_key" ON "domain_tlds"("ext");
