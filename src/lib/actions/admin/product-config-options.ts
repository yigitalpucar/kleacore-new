"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import type { ConfigOptionChoice } from "@/lib/products/configurator-types";
import { serializeMoney } from "@/lib/money";

interface ProductConfigOptionInput {
  productId: string;
  name: string;
  slug: string;
  optionType?: "select" | "quantity";
  choices?: ConfigOptionChoice[];
  minValue?: number | null;
  maxValue?: number | null;
  unitPrice?: number;
  unitPriceYearly?: number;
  isRequired?: boolean;
  displayOrder?: number;
  isActive?: boolean;
}

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase().replace(/\s+/g, "-");
}

function revalidateProductPaths(productId: string) {
  revalidatePath(`/yonetim/urunler/paketler/${productId}`);
  revalidatePath(`/yonetim/urunler/paketler/${productId}/duzenle`);
}

async function getNextDisplayOrder(productId: string) {
  const maxOption = await db.productConfigOption.findFirst({
    where: { productId },
    select: { displayOrder: true },
    orderBy: { displayOrder: "desc" },
  });

  return (maxOption?.displayOrder ?? 0) + 1;
}

export async function getAdminProductConfigOptions(productId: string) {
  await requireAdmin();

  const options = await db.productConfigOption.findMany({
    where: { productId },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
  // Unit prices as numbers: the result is passed to a client component.
  return serializeMoney(options);
}

export async function createProductConfigOption(data: ProductConfigOptionInput) {
  await requireAdmin();

  try {
    const productId = data.productId.trim();
    const name = data.name.trim();
    const slug = normalizeSlug(data.slug);

    if (!productId || !name || !slug) {
      return { success: false, error: "Ürün, ad ve slug zorunludur" };
    }

    const existing = await db.productConfigOption.findUnique({
      where: {
        productId_slug: {
          productId,
          slug,
        },
      },
    });

    if (existing) {
      return { success: false, error: "Bu ürün için aynı slug zaten kullanılıyor" };
    }

    const displayOrder =
      data.displayOrder !== undefined ? data.displayOrder : await getNextDisplayOrder(productId);

    const option = await db.productConfigOption.create({
      data: {
        productId,
        name,
        slug,
        optionType: data.optionType ?? "select",
        choices: (data.choices ?? []) as unknown as Prisma.InputJsonValue,
        minValue: data.minValue ?? null,
        maxValue: data.maxValue ?? null,
        unitPrice: data.unitPrice ?? 0,
        unitPriceYearly: data.unitPriceYearly ?? 0,
        isRequired: data.isRequired ?? false,
        displayOrder,
        isActive: data.isActive ?? true,
      },
    });

    revalidateProductPaths(productId);
    return { success: true, data: { id: option.id } };
  } catch {
    return { success: false, error: "Yapılandırma seçeneği oluşturulurken bir hata oluştu" };
  }
}

export async function updateProductConfigOption(
  id: string,
  data: Partial<Omit<ProductConfigOptionInput, "productId">>
) {
  await requireAdmin();

  try {
    const existing = await db.productConfigOption.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Yapılandırma seçeneği bulunamadı" };
    }

    const slug = data.slug ? normalizeSlug(data.slug) : undefined;

    if (slug && slug !== existing.slug) {
      const duplicate = await db.productConfigOption.findUnique({
        where: {
          productId_slug: {
            productId: existing.productId,
            slug,
          },
        },
      });

      if (duplicate) {
        return { success: false, error: "Bu ürün için aynı slug zaten kullanılıyor" };
      }
    }

    const option = await db.productConfigOption.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(slug !== undefined && { slug }),
        ...(data.optionType !== undefined && { optionType: data.optionType }),
        ...(data.choices !== undefined && {
          choices: data.choices as unknown as Prisma.InputJsonValue,
        }),
        ...(data.minValue !== undefined && { minValue: data.minValue }),
        ...(data.maxValue !== undefined && { maxValue: data.maxValue }),
        ...(data.unitPrice !== undefined && { unitPrice: data.unitPrice }),
        ...(data.unitPriceYearly !== undefined && { unitPriceYearly: data.unitPriceYearly }),
        ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
        ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    revalidateProductPaths(existing.productId);
    return { success: true, data: { id: option.id } };
  } catch {
    return { success: false, error: "Yapılandırma seçeneği güncellenirken bir hata oluştu" };
  }
}

export async function deleteProductConfigOption(id: string) {
  await requireAdmin();

  try {
    const existing = await db.productConfigOption.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Yapılandırma seçeneği bulunamadı" };
    }

    await db.productConfigOption.delete({ where: { id } });
    revalidateProductPaths(existing.productId);
    return { success: true };
  } catch {
    return { success: false, error: "Yapılandırma seçeneği silinirken bir hata oluştu" };
  }
}