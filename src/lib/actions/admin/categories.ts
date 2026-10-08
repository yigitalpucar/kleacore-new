"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { categoryCreateSchema } from "@/lib/validations/product";
import { revalidatePath } from "next/cache";
import type { ProductCategorySlug } from "@prisma/client";

interface CategoryInput {
  slug: ProductCategorySlug;
  name: string;
  description?: string;
  icon?: string;
  displayOrder?: number;
  isActive?: boolean;
}

function revalidateCategoryPaths() {
  revalidatePath("/yonetim/urunler");
  revalidatePath("/yonetim/urunler/kategoriler");
  revalidatePath("/yonetim/urunler/paketler");
}

export async function createCategory(data: CategoryInput) {
  await requirePermission("products.manage");

  try {
    const parsed = categoryCreateSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Geçersiz kategori bilgileri",
      };
    }

    const existing = await db.productCategory.findUnique({
      where: { slug: data.slug },
    });
    if (existing) {
      return { success: false, error: "Bu slug zaten kullanılıyor" };
    }

    const category = await db.productCategory.create({
      data: {
        slug: data.slug,
        name: data.name.trim(),
        description: data.description ?? "",
        icon: data.icon ?? "Package",
        displayOrder: data.displayOrder ?? 0,
        isActive: data.isActive ?? true,
      },
    });

    revalidateCategoryPaths();
    return { success: true, data: { id: category.id } };
  } catch {
    return { success: false, error: "Kategori oluşturulurken bir hata oluştu" };
  }
}

export async function updateCategory(id: string, data: Partial<CategoryInput>) {
  await requirePermission("products.manage");

  try {
    const category = await db.productCategory.findUnique({ where: { id } });
    if (!category) {
      return { success: false, error: "Kategori bulunamadı" };
    }

    await db.productCategory.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    revalidateCategoryPaths();
    return { success: true };
  } catch {
    return { success: false, error: "Kategori güncellenirken bir hata oluştu" };
  }
}

export async function deleteCategory(id: string) {
  await requirePermission("products.manage");

  try {
    const category = await db.productCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return { success: false, error: "Kategori bulunamadı" };
    }

    if (category._count.products > 0) {
      return {
        success: false,
        error: "Bu kategoride ürün bulunduğu için silinemez",
      };
    }

    await db.productCategory.delete({ where: { id } });

    revalidateCategoryPaths();
    return { success: true };
  } catch {
    return { success: false, error: "Kategori silinirken bir hata oluştu" };
  }
}

export async function moveCategory(
  id: string,
  direction: "up" | "down"
) {
  await requirePermission("products.manage");

  try {
    const current = await db.productCategory.findUnique({ where: { id } });
    if (!current) {
      return { success: false, error: "Kategori bulunamadı" };
    }

    const target =
      direction === "up"
        ? await db.productCategory.findFirst({
            where: { displayOrder: { lt: current.displayOrder } },
            orderBy: { displayOrder: "desc" },
          })
        : await db.productCategory.findFirst({
            where: { displayOrder: { gt: current.displayOrder } },
            orderBy: { displayOrder: "asc" },
          });

    if (!target) {
      return { success: true };
    }

    await db.$transaction([
      db.productCategory.update({
        where: { id: current.id },
        data: { displayOrder: target.displayOrder },
      }),
      db.productCategory.update({
        where: { id: target.id },
        data: { displayOrder: current.displayOrder },
      }),
    ]);

    revalidateCategoryPaths();
    return { success: true };
  } catch {
    return { success: false, error: "Kategori sırası güncellenirken bir hata oluştu" };
  }
}
