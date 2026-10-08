/**
 * Money math for e-invoices, kept local to this module.
 *
 * Invoice amounts enter here as whatever the core stores (number today,
 * Prisma.Decimal after the decimal migration) and are converted once to
 * integer kuruş. Everything below works on integers, so the totals we send to
 * the entegratör match the KLEACORE invoice to the kuruş.
 */

export type MoneyInput = number | string | { toString(): string };

/** Boundary conversion: any money value → integer kuruş (half away from zero). */
export function toKurus(value: MoneyInput | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const text = typeof value === "number" ? value.toFixed(6) : value.toString().trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    throw new Error(`EFATURA_INVALID_AMOUNT: ${text}`);
  }

  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  const padded = `${fraction}000`;
  let kurus = Number(whole) * 100 + Number(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) {
    kurus += 1;
  }

  return negative ? -kurus : kurus;
}

/** Integer kuruş → "1234.50" (UBL amount format, always two decimals). */
export function formatKurus(kurus: number): string {
  if (!Number.isInteger(kurus)) {
    throw new Error("EFATURA_NON_INTEGER_KURUS");
  }
  const negative = kurus < 0;
  const abs = Math.abs(kurus);
  const text = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return negative ? `-${text}` : text;
}

/** Tax on a net amount, rounded half-up to kuruş: net × rate / 100. */
export function taxOf(netKurus: number, ratePercent: number): number {
  // Rates are whole or one-decimal percentages; scale to avoid float error.
  const rateTimesTen = Math.round(ratePercent * 10);
  return Math.round((netKurus * rateTimesTen) / 1000);
}

/**
 * Split `total` kuruş across `weights` proportionally (largest remainder), so
 * the parts are integers and always sum exactly to `total`.
 */
export function allocateKurus(total: number, weights: number[]): number[] {
  if (weights.length === 0) {
    return [];
  }

  const positive = weights.map((weight) => Math.max(0, weight));
  const weightSum = positive.reduce((sum, weight) => sum + weight, 0);
  const basis = weightSum > 0 ? positive : positive.map(() => 1);
  const basisSum = weightSum > 0 ? weightSum : basis.length;

  const exact = basis.map((weight) => (total * weight) / basisSum);
  const parts = exact.map((value) => Math.floor(value));
  let remainder = total - parts.reduce((sum, part) => sum + part, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let i = 0; remainder > 0; i = (i + 1) % order.length) {
    parts[order[i].index] += 1;
    remainder -= 1;
  }

  return parts;
}

/** Unit price for a line: net / quantity, as a decimal string (up to 8 places). */
export function unitPriceString(netKurus: number, quantity: number): string {
  if (quantity <= 0) {
    return formatKurus(netKurus);
  }
  if (netKurus % quantity === 0) {
    return formatKurus(netKurus / quantity);
  }
  const value = netKurus / quantity / 100;
  return value.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}
