import { money, type MoneyInput } from "@/lib/money";

/**
 * Asymmetric matcher for money values in `toHaveBeenCalledWith` /
 * `toEqual`: matches a Prisma.Decimal, number or numeric string that equals
 * `expected` (so `moneyEq(100)` matches `new Prisma.Decimal("100.00")`).
 */
export function moneyEq(expected: MoneyInput) {
  return {
    asymmetricMatch: (actual: unknown) =>
      (typeof actual === "number" || typeof actual === "string" || (typeof actual === "object" && actual !== null)) &&
      money(actual as MoneyInput).equals(money(expected)),
    toString: () => `moneyEq(${String(expected)})`,
    toAsymmetricMatcher: () => `moneyEq(${String(expected)})`,
  };
}
