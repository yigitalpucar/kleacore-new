import { describe, expect, it, vi } from "vitest";
import { claimPromotionUse } from "./promo-usage";

function txWith(count: number) {
  const updateMany = vi.fn().mockResolvedValue({ count });
  return { tx: { promotionCode: { updateMany } } as never, updateMany };
}

describe("claimPromotionUse", () => {
  it("increments only while currentUses is below maxUses", async () => {
    const { tx, updateMany } = txWith(1);
    await claimPromotionUse(tx, { id: "promo_1", maxUses: 5 });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "promo_1", currentUses: { lt: 5 } },
      data: { currentUses: { increment: 1 } },
    });
  });

  it("fails checkout when a concurrent order took the last use", async () => {
    const { tx } = txWith(0);
    await expect(claimPromotionUse(tx, { id: "promo_1", maxUses: 1 })).rejects.toThrow(
      "PROMO_USAGE_LIMIT"
    );
  });

  it("does not cap unlimited codes (maxUses = 0)", async () => {
    const { tx, updateMany } = txWith(1);
    await claimPromotionUse(tx, { id: "promo_1", maxUses: 0 });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "promo_1" },
      data: { currentUses: { increment: 1 } },
    });
  });
});
