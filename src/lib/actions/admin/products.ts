"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { productCreateSchema } from "@/lib/validations/product";
import { revalidatePath } from "next/cache";
import type { BillingPeriod, Prisma, ProductCategorySlug } from "@prisma/client";

interface PricingTierInput {
  period: BillingPeriod;
  price: number;
  discountedPrice?: number | null;
  setupFee?: number;
  renewalPrice?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

interface ProductInput {
  categoryId: string;
  sku: string;
  name: string;
  slug: string;
  shortDescription?: string;
  longDescription?: string;
  features?: unknown;
  includedFeatures?: unknown;
  resourceLimits?: unknown;
  basePrice: number;
  badge?: string | null;
  isPopular?: boolean;
  displayOrder?: number;
  stockQuantity?: number;
  status?: "ACTIVE" | "INACTIVE" | "DRAFT" | "ARCHIVED";
  isVisible?: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
  pricingTiers?: PricingTierInput[];
}

export async function createProduct(data: ProductInput) {
  await requirePermission("products.manage");

  try {
    const parsed = productCreateSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Geçersiz ürün bilgileri",
      };
    }

    const existing = await db.product.findUnique({
      where: { slug: data.slug },
    });
    if (existing) {
      return { success: false, error: "Bu slug zaten kullanılıyor" };
    }

    const existingSku = await db.product.findUnique({
      where: { sku: data.sku },
    });
    if (existingSku) {
      return { success: false, error: "Bu SKU zaten kullanılıyor" };
    }

    const category = await db.productCategory.findUnique({
      where: { slug: data.categoryId as ProductCategorySlug },
    });
    if (!category) {
      return { success: false, error: "Geçersiz kategori" };
    }

    const { pricingTiers, ...productData } = data;

    const product = await db.product.create({
      data: {
        categoryId: category.id,
        sku: productData.sku,
        name: productData.name,
        slug: productData.slug,
        shortDescription: productData.shortDescription ?? "",
        longDescription: productData.longDescription ?? "",
        features: productData.features ?? [],
        includedFeatures: productData.includedFeatures ?? [],
        resourceLimits: productData.resourceLimits ?? {},
        basePrice: productData.basePrice,
        badge: productData.badge ?? null,
        isPopular: productData.isPopular ?? false,
        displayOrder: productData.displayOrder ?? 0,
        stockQuantity: productData.stockQuantity ?? -1,
        status: productData.status ?? "DRAFT",
        isVisible: productData.isVisible ?? true,
        metaTitle: productData.metaTitle ?? null,
        metaDescription: productData.metaDescription ?? null,
        ...(pricingTiers && pricingTiers.length > 0 && {
          pricingTiers: {
            create: pricingTiers.map((tier) => ({
              period: tier.period,
              price: tier.price,
              discountedPrice: tier.discountedPrice ?? null,
              setupFee: tier.setupFee ?? 0,
              renewalPrice: tier.renewalPrice ?? 0,
              isDefault: tier.isDefault ?? false,
              isActive: tier.isActive ?? true,
            })),
          },
        }),
      },
    });

    revalidatePath("/yonetim/urunler");
    return { success: true, data: { id: product.id } };
  } catch {
    return { success: false, error: "Ürün oluşturulurken bir hata oluştu" };
  }
}

export async function updateProduct(id: string, data: Partial<ProductInput>) {
  await requirePermission("products.manage");

  try {
    const product = await db.product.findUnique({ where: { id } });
    if (!product) {
      return { success: false, error: "Ürün bulunamadı" };
    }

    const { pricingTiers, ...productData } = data;

    const updateData: Prisma.ProductUpdateInput = {};

    if (productData.categoryId) {
      const category = await db.productCategory.findUnique({
        where: { slug: productData.categoryId as ProductCategorySlug },
      });
      if (!category) {
        return { success: false, error: "Geçersiz kategori" };
      }
      updateData.category = { connect: { id: category.id } };
    }
    if (productData.name) updateData.name = productData.name;
    if (productData.slug) updateData.slug = productData.slug;
    if (productData.sku) updateData.sku = productData.sku;
    if (productData.shortDescription !== undefined) updateData.shortDescription = productData.shortDescription;
    if (productData.longDescription !== undefined) updateData.longDescription = productData.longDescription;
    if (productData.features !== undefined) updateData.features = productData.features as Prisma.InputJsonValue;
    if (productData.includedFeatures !== undefined) updateData.includedFeatures = productData.includedFeatures as Prisma.InputJsonValue;
    if (productData.resourceLimits !== undefined) updateData.resourceLimits = productData.resourceLimits as Prisma.InputJsonValue;
    if (productData.basePrice !== undefined) updateData.basePrice = productData.basePrice;
    if (productData.badge !== undefined) updateData.badge = productData.badge;
    if (productData.isPopular !== undefined) updateData.isPopular = productData.isPopular;
    if (productData.displayOrder !== undefined) updateData.displayOrder = productData.displayOrder;
    if (productData.stockQuantity !== undefined) updateData.stockQuantity = productData.stockQuantity;
    if (productData.status) updateData.status = productData.status;
    if (productData.isVisible !== undefined) updateData.isVisible = productData.isVisible;
    if (productData.metaTitle !== undefined) updateData.metaTitle = productData.metaTitle;
    if (productData.metaDescription !== undefined) updateData.metaDescription = productData.metaDescription;

    await db.product.update({
      where: { id },
      data: updateData,
    });

    if (pricingTiers && pricingTiers.length > 0) {
      await db.pricingTier.deleteMany({ where: { productId: id } });
      await db.pricingTier.createMany({
        data: pricingTiers.map((tier) => ({
          productId: id,
          period: tier.period,
          price: tier.price,
          discountedPrice: tier.discountedPrice ?? null,
          setupFee: tier.setupFee ?? 0,
          renewalPrice: tier.renewalPrice ?? 0,
          isDefault: tier.isDefault ?? false,
          isActive: tier.isActive ?? true,
        })),
      });
    }

    revalidatePath("/yonetim/urunler");
    return { success: true };
  } catch {
    return { success: false, error: "Ürün güncellenirken bir hata oluştu" };
  }
}

export async function deleteProduct(id: string) {
  await requirePermission("products.manage");

  try {
    const product = await db.product.findUnique({ where: { id } });
    if (!product) {
      return { success: false, error: "Ürün bulunamadı" };
    }

    await db.product.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    revalidatePath("/yonetim/urunler");
    return { success: true };
  } catch {
    return { success: false, error: "Ürün silinirken bir hata oluştu" };
  }
}
