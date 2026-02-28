"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { promotionCreateSchema } from "@/lib/validations/product";
import { revalidatePath } from "next/cache";

interface PromotionInput {
  code: string;
  name: string;
  description?: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  applicableCategories?: string[];
  applicableProducts?: string[];
  applicablePeriods?: string[];
  maxUses?: number;
  maxUsesPerCustomer?: number;
  validFrom: string;
  validUntil: string;
  minOrderAmount?: number;
  isFirstOrderOnly?: boolean;
  isNewCustomerOnly?: boolean;
  status?: "ACTIVE" | "INACTIVE" | "EXPIRED";
}

export async function createPromotion(data: PromotionInput) {
  await requireAdmin();

  try {
    const parsed = promotionCreateSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Geçersiz promosyon bilgileri",
      };
    }

    const existing = await db.promotionCode.findUnique({
      where: { code: data.code.toUpperCase() },
    });
    if (existing) {
      return { success: false, error: "Bu promosyon kodu zaten kullanılıyor" };
    }

    const promotion = await db.promotionCode.create({
      data: {
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description ?? "",
        discountType: data.discountType,
        discountValue: data.discountValue,
        applicableCategories: data.applicableCategories ?? [],
        applicableProducts: data.applicableProducts ?? [],
        applicablePeriods: data.applicablePeriods ?? [],
        maxUses: data.maxUses ?? 0,
        maxUsesPerCustomer: data.maxUsesPerCustomer ?? 1,
        validFrom: new Date(data.validFrom),
        validUntil: new Date(data.validUntil),
        minOrderAmount: data.minOrderAmount ?? null,
        isFirstOrderOnly: data.isFirstOrderOnly ?? false,
        isNewCustomerOnly: data.isNewCustomerOnly ?? false,
        status: data.status ?? "ACTIVE",
      },
    });

    revalidatePath("/yonetim/urunler/promosyonlar");
    return { success: true, data: { id: promotion.id } };
  } catch {
    return { success: false, error: "Promosyon oluşturulurken bir hata oluştu" };
  }
}

export async function updatePromotion(id: string, data: Partial<PromotionInput>) {
  await requireAdmin();

  try {
    const promotion = await db.promotionCode.findUnique({ where: { id } });
    if (!promotion) {
      return { success: false, error: "Promosyon bulunamadı" };
    }

    await db.promotionCode.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.discountType && { discountType: data.discountType }),
        ...(data.discountValue !== undefined && { discountValue: data.discountValue }),
        ...(data.applicableCategories && { applicableCategories: data.applicableCategories }),
        ...(data.applicableProducts && { applicableProducts: data.applicableProducts }),
        ...(data.applicablePeriods && { applicablePeriods: data.applicablePeriods }),
        ...(data.maxUses !== undefined && { maxUses: data.maxUses }),
        ...(data.maxUsesPerCustomer !== undefined && { maxUsesPerCustomer: data.maxUsesPerCustomer }),
        ...(data.validFrom && { validFrom: new Date(data.validFrom) }),
        ...(data.validUntil && { validUntil: new Date(data.validUntil) }),
        ...(data.minOrderAmount !== undefined && { minOrderAmount: data.minOrderAmount }),
        ...(data.isFirstOrderOnly !== undefined && { isFirstOrderOnly: data.isFirstOrderOnly }),
        ...(data.isNewCustomerOnly !== undefined && { isNewCustomerOnly: data.isNewCustomerOnly }),
        ...(data.status && { status: data.status }),
      },
    });

    revalidatePath("/yonetim/urunler/promosyonlar");
    return { success: true };
  } catch {
    return { success: false, error: "Promosyon güncellenirken bir hata oluştu" };
  }
}

export async function deletePromotion(id: string) {
  await requireAdmin();

  try {
    const promotion = await db.promotionCode.findUnique({ where: { id } });
    if (!promotion) {
      return { success: false, error: "Promosyon bulunamadı" };
    }

    await db.promotionCode.delete({ where: { id } });

    revalidatePath("/yonetim/urunler/promosyonlar");
    return { success: true };
  } catch {
    return { success: false, error: "Promosyon silinirken bir hata oluştu" };
  }
}
