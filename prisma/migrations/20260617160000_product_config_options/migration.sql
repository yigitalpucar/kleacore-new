-- CreateTable
CREATE TABLE "product_config_options" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "optionType" TEXT NOT NULL DEFAULT 'select',
    "choices" JSONB NOT NULL DEFAULT '[]',
    "minValue" INTEGER,
    "maxValue" INTEGER,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPriceYearly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_config_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_config_options_productId_slug_key" ON "product_config_options"("productId", "slug");

-- AddForeignKey
ALTER TABLE "product_config_options" ADD CONSTRAINT "product_config_options_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;