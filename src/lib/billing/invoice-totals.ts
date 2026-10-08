import type { Prisma } from "@prisma/client";
import { allocate, money, percent, roundHalfUp, sum, type MoneyInput } from "@/lib/money";

export interface InvoiceLineInput {
  quantity: number;
  unitPrice: MoneyInput;
}

export interface InvoiceTotals {
  lines: Array<{
    quantity: number;
    unitPrice: Prisma.Decimal;
    /** quantity × unitPrice, rounded half-up to kuruş (VAT-exclusive). */
    totalPrice: Prisma.Decimal;
    /** This line's share of the invoice KDV; the shares add up to `taxAmount`. */
    taxAmount: Prisma.Decimal;
  }>;
  subtotal: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
}

/**
 * Invoice totals from its lines, all in Decimal:
 *   line total = round(quantity × unitPrice)
 *   subtotal   = Σ line totals            (so the invoice always equals its lines)
 *   KDV        = round(subtotal × rate %)  (computed once, on the invoice)
 *   total      = subtotal + KDV
 * Line KDV shares are allocated from the invoice KDV so Σ line gross == total.
 */
export function calculateInvoiceTotals(lines: InvoiceLineInput[], taxRate: MoneyInput): InvoiceTotals {
  const rate = money(taxRate);
  const computed = lines.map((line) => {
    const unitPrice = roundHalfUp(line.unitPrice);
    return {
      quantity: line.quantity,
      unitPrice,
      totalPrice: roundHalfUp(unitPrice.times(line.quantity)),
    };
  });

  const subtotal = sum(computed.map((line) => line.totalPrice));
  const taxAmount = percent(subtotal, rate);
  const lineTaxes = allocate(
    taxAmount,
    computed.map((line) => line.totalPrice)
  );

  return {
    lines: computed.map((line, index) => ({ ...line, taxAmount: lineTaxes[index] ?? money(0) })),
    subtotal,
    taxRate: rate,
    taxAmount,
    totalAmount: subtotal.plus(taxAmount),
  };
}
