-- AlterTable
ALTER TABLE "users" ADD COLUMN "isReseller" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "resellerDiscountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "parentResellerId" TEXT;

-- CreateIndex
CREATE INDEX "users_parentResellerId_idx" ON "users"("parentResellerId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_parentResellerId_fkey" FOREIGN KEY ("parentResellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;