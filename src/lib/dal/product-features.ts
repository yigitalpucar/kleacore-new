import { db } from "@/lib/db";
import type { ProductCategorySlug } from "@prisma/client";

export async function getAllProductFeatures() {
  return db.productFeature.findMany({
    orderBy: [{ categoryId: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
  });
}

export async function getProductFeaturesByCategory(categoryId: ProductCategorySlug) {
  return db.productFeature.findMany({
    where: { categoryId },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
}

export async function getProductFeatureById(id: string) {
  return db.productFeature.findUnique({
    where: { id },
  });
}
