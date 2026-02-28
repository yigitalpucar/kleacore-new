-- CreateTable
CREATE TABLE "product_features" (
    "id" TEXT NOT NULL,
    "categoryId" "ProductCategorySlug" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'Tag',
    "isHighlighted" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_features_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_features_categoryId_displayOrder_idx" ON "product_features"("categoryId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "product_features_categoryId_slug_key" ON "product_features"("categoryId", "slug");

-- AddForeignKey
ALTER TABLE "product_features" ADD CONSTRAINT "product_features_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
