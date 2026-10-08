import type { Prisma } from "@prisma/client";

/**
 * Atomically consumes one use of a promotion code inside the checkout
 * transaction. Concurrent checkouts can all pass the earlier
 * `currentUses < maxUses` read, but only as many as `maxUses` can win this
 * conditional (row-locked) update; the rest throw and roll back.
 * `maxUses` of 0 means unlimited.
 */
export async function claimPromotionUse(
  tx: Pick<Prisma.TransactionClient, "promotionCode">,
  promotion: { id: string; maxUses: number }
) {
  const claimed = await tx.promotionCode.updateMany({
    where: {
      id: promotion.id,
      ...(promotion.maxUses > 0 && { currentUses: { lt: promotion.maxUses } }),
    },
    data: { currentUses: { increment: 1 } },
  });

  if (claimed.count === 0) {
    throw new Error("PROMO_USAGE_LIMIT");
  }
}
