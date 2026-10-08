import type { Metadata } from "next";
import { getPromotions } from "@/lib/dal/promotions";
import { PromotionsContent } from "./content";
import { toNumber, toNumberOrNull } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Promosyonlar" };

export default async function PromotionsPage() {
  const promotions = await getPromotions();

  const serialized = promotions.map((promo) => ({
    id: promo.id,
    code: promo.code,
    name: promo.name,
    description: promo.description,
    discountType: promo.discountType.toLowerCase() as "percentage" | "fixed",
    discountValue: toNumber(promo.discountValue),
    applicableCategories: promo.applicableCategories as string[],
    applicableProducts: promo.applicableProducts as string[],
    applicablePeriods: promo.applicablePeriods as string[],
    maxUses: promo.maxUses,
    maxUsesPerCustomer: promo.maxUsesPerCustomer,
    currentUses: promo.currentUses,
    validFrom: promo.validFrom.toISOString(),
    validUntil: promo.validUntil.toISOString(),
    minOrderAmount: toNumberOrNull(promo.minOrderAmount),
    isFirstOrderOnly: promo.isFirstOrderOnly,
    isNewCustomerOnly: promo.isNewCustomerOnly,
    status: promo.status.toLowerCase() as "active" | "inactive" | "expired",
    createdAt: promo.createdAt.toISOString(),
    updatedAt: promo.updatedAt.toISOString(),
  }));

  return <PromotionsContent promotions={serialized} />;
}
