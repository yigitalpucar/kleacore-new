import { db } from "@/lib/db";
import type { ProductCategorySlug } from "@prisma/client";

export async function getCategories() {
  return db.productCategory.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: { products: true },
      },
    },
    orderBy: { displayOrder: "asc" },
  });
}

export async function getAllCategories() {
  return db.productCategory.findMany({
    include: {
      _count: {
        select: { products: true },
      },
    },
    orderBy: { displayOrder: "asc" },
  });
}

export async function getCategoryById(id: string) {
  return db.productCategory.findUnique({
    where: { id },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });
}

export async function getCategoryWithProducts(slug: ProductCategorySlug) {
  return db.productCategory.findUnique({
    where: { slug },
    include: {
      products: {
        where: {
          status: "ACTIVE",
          isVisible: true,
        },
        include: {
          pricingTiers: {
            where: { isActive: true },
            orderBy: { price: "asc" },
          },
        },
        orderBy: { displayOrder: "asc" },
      },
    },
  });
}
