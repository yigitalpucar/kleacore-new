import { calculateTax } from "@/lib/billing/tax";
import { applyResellerDiscount } from "@/lib/reseller";
import {
  add,
  div,
  max,
  money,
  mul,
  roundHalfUp,
  sub,
  type MoneyInput,
} from "@/lib/money";
import type { Prisma } from "@prisma/client";

export interface AllocatableLine {
  unitPrice: MoneyInput;
  quantity: number;
  /** Whether the promotion code covers this line (category/product/period rules). */
  promoApplies: boolean;
}

export interface AllocatedLine {
  lineTotal: Prisma.Decimal;
  promoLineDiscount: Prisma.Decimal;
  resellerLineDiscount: Prisma.Decimal;
  lineDiscount: Prisma.Decimal;
  payableLineTotal: Prisma.Decimal;
  taxed: ReturnType<typeof calculateTax>;
}

/**
 * Per-line amounts of a cart exactly as checkout invoices them — every cart
 * line becomes its own order + invoice:
 *
 * - the promo discount is spread over the lines it covers pro rata, the last
 *   covered line takes the remainder so the line discounts add up exactly;
 * - the reseller discount is taken from what is left after the promo;
 * - KDV is computed (and rounded) per line.
 *
 * Shared by checkoutCart (src/lib/actions/customer/checkout.ts) and the cart
 * quote shown before payment, so the two can never disagree.
 */
export function allocateCartLines(
  lines: AllocatableLine[],
  options: {
    promotion: { discountAmount: MoneyInput; applicableTotal: MoneyInput } | null;
    resellerPercent: MoneyInput | null;
    taxRate: MoneyInput;
  }
): AllocatedLine[] {
  const { promotion, resellerPercent, taxRate } = options;
  const applicableIndexes = promotion
    ? lines.map((line, index) => (line.promoApplies ? index : -1)).filter((index) => index >= 0)
    : [];
  const lastApplicableIndex = applicableIndexes[applicableIndexes.length - 1] ?? -1;
  let remainingDiscount = money(promotion?.discountAmount ?? 0);

  return lines.map((line, index) => {
    const lineTotal = roundHalfUp(mul(line.unitPrice, line.quantity));
    const promoLineDiscount =
      promotion && line.promoApplies
        ? index === lastApplicableIndex
          ? roundHalfUp(remainingDiscount)
          : roundHalfUp(div(mul(lineTotal, promotion.discountAmount), promotion.applicableTotal))
        : money(0);
    remainingDiscount = sub(remainingDiscount, promoLineDiscount);
    const afterPromoTotal = max(0, sub(lineTotal, promoLineDiscount));
    const resellerLineDiscount =
      resellerPercent !== null ? applyResellerDiscount(afterPromoTotal, resellerPercent) : money(0);
    const lineDiscount = add(promoLineDiscount, resellerLineDiscount);
    const payableLineTotal = max(0, sub(lineTotal, lineDiscount));
    const taxed = calculateTax(payableLineTotal, taxRate);
    return { lineTotal, promoLineDiscount, resellerLineDiscount, lineDiscount, payableLineTotal, taxed };
  });
}
