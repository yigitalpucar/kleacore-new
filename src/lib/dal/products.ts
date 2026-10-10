import { db } from "@/lib/db";
import { mapConfigOption } from "@/lib/products/configurator-pricing";
import {
  type PaginationParams,
  paginationMeta,
} from "@/lib/utils/pagination";
import type { ProductCategorySlug, ProductStatus } from "@prisma/client";

interface GetProductsParams extends PaginationParams {
  status?: ProductStatus;
  categorySlug?: ProductCategorySlug;
  isVisible?: boolean;
}

export async function getProducts(params: GetProductsParams) {
  const { page, perPage, search, sortBy, sortOrder, status, categorySlug, isVisible } =
    params;

  const where = {
    ...(status && { status }),
    ...(isVisible !== undefined && { isVisible }),
    ...(categorySlug && {
      category: { slug: categorySlug },
    }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { sku: { contains: search, mode: "insensitive" as const } },
        { shortDescription: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        category: true,
        pricingTiers: {
          where: { isActive: true },
          orderBy: { price: "asc" },
        },
      },
      orderBy: { [sortBy || "displayOrder"]: sortOrder || "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.product.count({ where }),
  ]);

  return { data, ...paginationMeta(total, params) };
}

export async function getProductById(id: string) {
  return db.product.findUnique({
    where: { id },
    include: {
      category: true,
      pricingTiers: {
        orderBy: { price: "asc" },
      },
    },
  });
}

export async function getProductsByCategory(slug: ProductCategorySlug) {
  return db.product.findMany({
    where: {
      category: { slug },
      status: "ACTIVE",
      isVisible: true,
    },
    include: {
      category: true,
      pricingTiers: {
        where: { isActive: true },
        orderBy: { price: "asc" },
      },
    },
    orderBy: { displayOrder: "asc" },
  });
}

export async function getProductWithPricing(id: string) {
  return db.product.findUnique({
    where: { id },
    include: {
      category: true,
      pricingTiers: {
        where: { isActive: true },
        orderBy: { price: "asc" },
      },
    },
  });
}

export async function getProductsBySubType(
  categorySlug: ProductCategorySlug,
  subType?: string
) {
  return db.product.findMany({
    where: {
      category: { slug: categorySlug },
      ...(subType ? { subType } : {}),
      status: "ACTIVE",
      isVisible: true,
    },
    include: {
      category: true,
      pricingTiers: { where: { isActive: true }, orderBy: { price: "asc" } },
    },
    orderBy: { displayOrder: "asc" },
  });
}

export async function getProductStats() {
  const [totalProducts, activeProducts, draftProducts, totalCategories] =
    await Promise.all([
      db.product.count(),
      db.product.count({ where: { status: "ACTIVE" } }),
      db.product.count({ where: { status: "DRAFT" } }),
      db.productCategory.count({ where: { isActive: true } }),
    ]);

  return { totalProducts, activeProducts, draftProducts, totalCategories };
}

export async function getProductBySlug(slug: string) {
  return db.product.findUnique({
    where: { slug },
    include: {
      category: true,
      pricingTiers: {
        where: { isActive: true },
        orderBy: { price: "asc" },
      },
    },
  });
}

export async function getAddonsByCategory(
  categorySlug: ProductCategorySlug,
  subType?: string
) {
  const addons = await db.productAddon.findMany({
    where: {
      categorySlug,
      isActive: true,
    },
    orderBy: { displayOrder: "asc" },
  });

  if (!subType) return addons;

  return addons.filter((addon) => {
    const applicable = addon.applicableSubTypes as string[];
    return applicable.length === 0 || applicable.includes(subType);
  });
}

export async function getProductCategoryCounts() {
  const categories = await db.productCategory.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { products: true } },
    },
    orderBy: { displayOrder: "asc" },
  });

  return categories.map((cat) => ({
    slug: cat.slug,
    name: cat.name,
    productCount: cat._count.products,
  }));
}

/** Active configurable options of the given products, keyed by product id. */
export async function getConfigOptionsByProduct(productIds: string[]) {
  const rows =
    productIds.length > 0
      ? await db.productConfigOption.findMany({
          where: { productId: { in: productIds }, isActive: true },
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        })
      : [];
  const byProduct = new Map<string, ReturnType<typeof mapConfigOption>[]>();
  for (const row of rows) {
    const list = byProduct.get(row.productId) ?? [];
    list.push(mapConfigOption(row));
    byProduct.set(row.productId, list);
  }
  return byProduct;
}
