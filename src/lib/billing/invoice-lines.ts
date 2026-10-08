import type { Prisma } from "@prisma/client";
import { max, money, mul, roundHalfUp, sub, type MoneyInput } from "@/lib/money";

/**
 * InvoiceItem semantics (one meaning for every writer and reader):
 *
 *   unitPrice      net (KDV-exclusive) unit price, before the line discount
 *   discountAmount net line discount (promo, reseller, renewal-period discount)
 *   totalPrice     net line total = round(unitPrice × quantity) − discountAmount
 *
 * KDV lives on the invoice only: Σ totalPrice = invoice.subtotal,
 * invoice.taxAmount = round(subtotal × taxRate), totalAmount = subtotal + tax.
 * The e-invoice builder, PDF and invoice views read the lines this way.
 */
export interface NetInvoiceLineInput {
  description: string;
  quantity?: number;
  /** Net unit price before discount. */
  unitPrice: MoneyInput;
  /** Net discount for the whole line. */
  discountAmount?: MoneyInput;
}

export interface NetInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
}

export function netInvoiceLine(input: NetInvoiceLineInput): NetInvoiceLine {
  const quantity = Math.max(1, Math.trunc(input.quantity ?? 1));
  const unitPrice = roundHalfUp(input.unitPrice);
  const gross = roundHalfUp(mul(unitPrice, quantity));
  const discountAmount = roundHalfUp(max(0, money(input.discountAmount)));

  if (discountAmount.greaterThan(gross)) {
    throw new Error("INVOICE_LINE_DISCOUNT_EXCEEDS_TOTAL");
  }

  return {
    description: input.description,
    quantity,
    unitPrice,
    discountAmount,
    totalPrice: sub(gross, discountAmount),
  };
}

/**
 * The single invoice line of an order invoice, built from the order's own
 * net amounts (basePrice = net before discount, discountAmount = net
 * discount), so it always equals `subtotal = basePrice − discountAmount`.
 */
export function netInvoiceLineFromOrder(
  order: { basePrice: MoneyInput; discountAmount: MoneyInput; quantity: number },
  description: string
): NetInvoiceLine {
  const quantity = Math.max(1, Math.trunc(order.quantity || 1));
  const base = roundHalfUp(order.basePrice);
  const unitPrice = roundHalfUp(base.dividedBy(quantity));
  // A base price that doesn't split into equal kuruş units is billed as one line.
  const exact = unitPrice.times(quantity).equals(base);

  return netInvoiceLine({
    description,
    quantity: exact ? quantity : 1,
    unitPrice: exact ? unitPrice : base,
    discountAmount: order.discountAmount,
  });
}

/**
 * OrderItem amounts use the same net semantics as InvoiceItem: unitPrice =
 * net unit price, discountAmount = net line discount, totalPrice = net line
 * total. KDV lives on the order (taxAmount / totalAmount) only.
 */
export function netOrderItemAmounts(input: Omit<NetInvoiceLineInput, "description">) {
  const { quantity, unitPrice, discountAmount, totalPrice } = netInvoiceLine({ ...input, description: "" });
  return { quantity, unitPrice, discountAmount, totalPrice };
}
