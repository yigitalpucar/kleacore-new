import { add, mul, percent, roundHalfUp, sum, toNumber, type MoneyInput } from "@/lib/money";

export interface CartLine {
  unitPrice: MoneyInput;
  quantity: number;
}

/**
 * Cart summary exactly as checkout will charge it: every cart line becomes its
 * own order + invoice (src/lib/actions/customer/checkout.ts), so KDV is
 * rounded per line and then summed — not computed once on the cart subtotal.
 * Promotions / reseller discounts are applied at checkout and not shown here.
 */
export function cartTotals(lines: CartLine[], taxRate: MoneyInput) {
  const lineTotals = lines.map((line) => roundHalfUp(mul(line.unitPrice, line.quantity)));
  const subtotal = sum(lineTotals);
  const taxAmount = sum(lineTotals.map((lineTotal) => percent(lineTotal, taxRate)));
  return {
    subtotal: toNumber(subtotal),
    taxAmount: toNumber(taxAmount),
    total: toNumber(add(subtotal, taxAmount)),
  };
}
