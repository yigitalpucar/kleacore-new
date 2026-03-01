-- CreateTable
CREATE TABLE "product_addons" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "categorySlug" "ProductCategorySlug" NOT NULL,
    "applicableSubTypes" JSONB NOT NULL DEFAULT '[]',
    "monthlyPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearlyPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "setupFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "icon" TEXT NOT NULL DEFAULT 'Package',
    "badge" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_addons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_addons_sku_key" ON "product_addons"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_addons_slug_key" ON "product_addons"("slug");
