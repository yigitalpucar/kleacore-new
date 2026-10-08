"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { productFeatureCreateSchema } from "@/lib/validations/product";
import { revalidatePath } from "next/cache";
import type { ProductCategorySlug } from "@prisma/client";

interface ProductFeatureInput {
  categoryId: ProductCategorySlug;
  name: string;
  slug: string;
  unit?: string;
  icon?: string;
  isHighlighted?: boolean;
  displayOrder?: number;
  isActive?: boolean;
}

async function getNextDisplayOrder(categoryId: ProductCategorySlug) {
  const maxFeature = await db.productFeature.findFirst({
    where: { categoryId },
    select: { displayOrder: true },
    orderBy: { displayOrder: "desc" },
  });
  return (maxFeature?.displayOrder ?? 0) + 1;
}

function revalidateFeaturesPage() {
  revalidatePath("/yonetim/urunler/ozellikler");
}

export async function createProductFeature(data: ProductFeatureInput) {
  await requirePermission("products.manage");

  try {
    const parsed = productFeatureCreateSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Geçersiz özellik bilgileri",
      };
    }

    const slug = data.slug.trim().toLowerCase();
    const existing = await db.productFeature.findUnique({
      where: {
        categoryId_slug: {
          categoryId: data.categoryId,
          slug,
        },
      },
    });

    if (existing) {
      return { success: false, error: "Bu kategoride aynı slug zaten kullanılıyor" };
    }

    const displayOrder =
      data.displayOrder !== undefined
        ? data.displayOrder
        : await getNextDisplayOrder(data.categoryId);

    const feature = await db.productFeature.create({
      data: {
        categoryId: data.categoryId,
        name: data.name.trim(),
        slug,
        unit: data.unit?.trim() ?? "",
        icon: data.icon?.trim() || "Tag",
        isHighlighted: data.isHighlighted ?? false,
        displayOrder,
        isActive: data.isActive ?? true,
      },
    });

    revalidateFeaturesPage();
    return { success: true, data: { id: feature.id } };
  } catch {
    return { success: false, error: "Özellik oluşturulurken bir hata oluştu" };
  }
}

export async function updateProductFeature(id: string, data: Partial<ProductFeatureInput>) {
  await requirePermission("products.manage");

  try {
    const existing = await db.productFeature.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Özellik bulunamadı" };
    }

    const nextCategoryId = data.categoryId ?? existing.categoryId;
    const nextSlug = data.slug?.trim().toLowerCase() ?? existing.slug;

    if (nextCategoryId !== existing.categoryId || nextSlug !== existing.slug) {
      const duplicate = await db.productFeature.findUnique({
        where: {
          categoryId_slug: {
            categoryId: nextCategoryId,
            slug: nextSlug,
          },
        },
      });
      if (duplicate && duplicate.id !== id) {
        return { success: false, error: "Bu kategoride aynı slug zaten kullanılıyor" };
      }
    }

    await db.productFeature.update({
      where: { id },
      data: {
        ...(data.categoryId && { categoryId: data.categoryId }),
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.slug !== undefined && { slug: nextSlug }),
        ...(data.unit !== undefined && { unit: data.unit.trim() }),
        ...(data.icon !== undefined && { icon: data.icon.trim() || "Tag" }),
        ...(data.isHighlighted !== undefined && { isHighlighted: data.isHighlighted }),
        ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    revalidateFeaturesPage();
    return { success: true };
  } catch {
    return { success: false, error: "Özellik güncellenirken bir hata oluştu" };
  }
}

export async function deleteProductFeature(id: string) {
  await requirePermission("products.manage");

  try {
    const existing = await db.productFeature.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Özellik bulunamadı" };
    }

    await db.productFeature.delete({ where: { id } });

    revalidateFeaturesPage();
    return { success: true };
  } catch {
    return { success: false, error: "Özellik silinirken bir hata oluştu" };
  }
}

export async function setProductFeatureActive(id: string, isActive: boolean) {
  await requirePermission("products.manage");

  try {
    const existing = await db.productFeature.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Özellik bulunamadı" };
    }

    await db.productFeature.update({
      where: { id },
      data: { isActive },
    });

    revalidateFeaturesPage();
    return { success: true };
  } catch {
    return { success: false, error: "Özellik durumu güncellenemedi" };
  }
}

export async function setProductFeatureHighlighted(id: string, isHighlighted: boolean) {
  await requirePermission("products.manage");

  try {
    const existing = await db.productFeature.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Özellik bulunamadı" };
    }

    await db.productFeature.update({
      where: { id },
      data: { isHighlighted },
    });

    revalidateFeaturesPage();
    return { success: true };
  } catch {
    return { success: false, error: "Öne çıkan bilgisi güncellenemedi" };
  }
}

export async function moveProductFeature(
  id: string,
  direction: "up" | "down"
) {
  await requirePermission("products.manage");

  try {
    const current = await db.productFeature.findUnique({ where: { id } });
    if (!current) {
      return { success: false, error: "Özellik bulunamadı" };
    }

    const target =
      direction === "up"
        ? await db.productFeature.findFirst({
            where: {
              categoryId: current.categoryId,
              displayOrder: { lt: current.displayOrder },
            },
            orderBy: { displayOrder: "desc" },
          })
        : await db.productFeature.findFirst({
            where: {
              categoryId: current.categoryId,
              displayOrder: { gt: current.displayOrder },
            },
            orderBy: { displayOrder: "asc" },
          });

    if (!target) {
      return { success: true };
    }

    await db.$transaction([
      db.productFeature.update({
        where: { id: current.id },
        data: { displayOrder: target.displayOrder },
      }),
      db.productFeature.update({
        where: { id: target.id },
        data: { displayOrder: current.displayOrder },
      }),
    ]);

    revalidateFeaturesPage();
    return { success: true };
  } catch {
    return { success: false, error: "Sıralama güncellenirken bir hata oluştu" };
  }
}
