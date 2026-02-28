import { getPromotions } from "@/lib/dal/promotions";
import { PromotionsContent } from "./content";

export default async function PromotionsPage() {
  const promotions = await getPromotions();

  const serialized = promotions.map((promo) => ({
    id: promo.id,
    code: promo.code,
    name: promo.name,
    description: promo.description,
    discountType: promo.discountType.toLowerCase() as "percentage" | "fixed",
    discountValue: promo.discountValue,
    applicableCategories: promo.applicableCategories as string[],
    applicableProducts: promo.applicableProducts as string[],
    applicablePeriods: promo.applicablePeriods as string[],
    maxUses: promo.maxUses,
    maxUsesPerCustomer: promo.maxUsesPerCustomer,
    currentUses: promo.currentUses,
    validFrom: promo.validFrom.toISOString(),
    validUntil: promo.validUntil.toISOString(),
    minOrderAmount: promo.minOrderAmount,
    isFirstOrderOnly: promo.isFirstOrderOnly,
    isNewCustomerOnly: promo.isNewCustomerOnly,
    status: promo.status.toLowerCase() as "active" | "inactive" | "expired",
    createdAt: promo.createdAt.toISOString(),
    updatedAt: promo.updatedAt.toISOString(),
  }));

  return <PromotionsContent promotions={serialized} />;
}
