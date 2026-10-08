/**
 * Domain sale prices from registrar cost (3.9).
 *
 *   suggested = round( cost × TCMB ForexSelling × (1 + marginPercent/100) + marginFixedTry )
 *
 * Prices are TRY, KDV-exclusive, like DomainTld.registerPrice/renewPrice/
 * transferPrice. Rounding always goes UP to the chosen ending, so rounding can
 * never eat into the margin. Nothing here writes prices on its own: the admin
 * applies suggestions from /yonetim/urunler/tld-fiyatlari, or the opt-in
 * daily auto-apply (rules.autoApply, default off) does it after the FX sync.
 */
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { compare, div, money, mul, roundHalfUp, sub, type MoneyInput } from "@/lib/money";
import { pickRate, type RateRow, type ResolvedRate } from "./rates";

export const TLD_PRICING_RULES_KEY = "fx_tld_pricing_rules";

export const ROUNDING_MODES = ["none", "x90", "x99", "whole"] as const;
export type RoundingMode = (typeof ROUNDING_MODES)[number];

export const ROUNDING_LABELS: Record<RoundingMode, string> = {
  none: "Kuruşa yuvarla",
  x90: ",90 ile bitir",
  x99: ",99 ile bitir",
  whole: "Tam liraya yuvarla",
};

/** Auto-apply never moves a price by more than this (bad bulletin, typo'd cost). */
export const AUTO_APPLY_MAX_CHANGE_PERCENT = 30;

export const tldPricingRulesSchema = z.object({
  marginPercent: z.number().min(0).max(1000),
  marginFixedTry: z.number().min(0).max(100000),
  rounding: z.enum(ROUNDING_MODES),
  autoApply: z.boolean(),
  /** Admin who last saved the rules (auto-apply audit entries are attributed to them). */
  updatedBy: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

export type TldPricingRules = z.infer<typeof tldPricingRulesSchema>;

export const DEFAULT_TLD_PRICING_RULES: TldPricingRules = {
  marginPercent: 30,
  marginFixedTry: 0,
  rounding: "x90",
  autoApply: false,
  updatedBy: null,
  updatedAt: null,
};

/** Parses the stored setting; anything invalid falls back to the defaults (auto-apply off). */
export function parseTldPricingRules(raw: string | null | undefined): TldPricingRules {
  if (!raw) return { ...DEFAULT_TLD_PRICING_RULES };
  try {
    const parsed = tldPricingRulesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : { ...DEFAULT_TLD_PRICING_RULES };
  } catch {
    return { ...DEFAULT_TLD_PRICING_RULES };
  }
}

export async function getTldPricingRules(client: Pick<typeof db, "setting"> = db): Promise<TldPricingRules> {
  const row = await client.setting.findUnique({ where: { key: TLD_PRICING_RULES_KEY }, select: { value: true } });
  return parseTldPricingRules(row?.value);
}

/** Rounds a TRY amount UP to the rule's ending (never below the input, kuruş-exact). */
export function applyRounding(value: MoneyInput, mode: RoundingMode): Prisma.Decimal {
  const amount = roundHalfUp(value);
  if (amount.lte(0)) return amount;
  switch (mode) {
    case "none":
      return amount;
    case "whole":
      return amount.ceil();
    case "x90":
    case "x99": {
      const ending = new Prisma.Decimal(mode === "x90" ? "0.90" : "0.99");
      const candidate = amount.floor().plus(ending);
      return candidate.gte(amount) ? candidate : candidate.plus(1);
    }
  }
}

/** Suggested TRY sale price for a cost already converted with `rate`. */
export function suggestPrice(cost: MoneyInput | null, rate: MoneyInput, rules: Pick<TldPricingRules, "marginPercent" | "marginFixedTry" | "rounding">): Prisma.Decimal | null {
  if (cost === null || cost === undefined) return null;
  const base = money(cost);
  if (base.lte(0)) return null;
  const costTry = mul(base, rate);
  const withMargin = mul(costTry, money(rules.marginPercent).dividedBy(100).plus(1)).plus(money(rules.marginFixedTry));
  return applyRounding(withMargin, rules.rounding);
}

export const TLD_PRICE_KINDS = ["register", "renew", "transfer"] as const;
export type TldPriceKind = (typeof TLD_PRICE_KINDS)[number];

const PRICE_FIELD = {
  register: "registerPrice",
  renew: "renewPrice",
  transfer: "transferPrice",
} as const satisfies Record<TldPriceKind, string>;

const COST_FIELD = {
  register: "costRegister",
  renew: "costRenew",
  transfer: "costTransfer",
} as const satisfies Record<TldPriceKind, string>;

export interface TldCostRow {
  id: string;
  ext: string;
  isActive: boolean;
  registerPrice: Prisma.Decimal;
  renewPrice: Prisma.Decimal;
  transferPrice: Prisma.Decimal;
  costRegister: Prisma.Decimal | null;
  costRenew: Prisma.Decimal | null;
  costTransfer: Prisma.Decimal | null;
  costCurrency: string;
}

export interface TldPriceLine {
  kind: TldPriceKind;
  cost: Prisma.Decimal | null;
  costTry: Prisma.Decimal | null;
  current: Prisma.Decimal;
  suggested: Prisma.Decimal | null;
  /** suggested − current (null without a suggestion). */
  delta: Prisma.Decimal | null;
  /** (current − costTry) / current × 100: margin of the price in effect today. */
  currentMarginPercent: Prisma.Decimal | null;
}

export interface TldSuggestion {
  id: string;
  ext: string;
  isActive: boolean;
  costCurrency: string;
  rate: ResolvedRate | null;
  lines: Record<TldPriceKind, TldPriceLine>;
  /** At least one price would change. */
  changed: boolean;
}

/** Pure: price lines of one TLD for the given rates (rows of the latest bulletin). */
export function buildTldSuggestion(tld: TldCostRow, rates: RateRow[], day: string, rules: TldPricingRules): TldSuggestion {
  const rate = pickRate(rates, tld.costCurrency, day, "selling");
  const lines = {} as Record<TldPriceKind, TldPriceLine>;
  let changed = false;

  for (const kind of TLD_PRICE_KINDS) {
    const cost = tld[COST_FIELD[kind]];
    const current = tld[PRICE_FIELD[kind]];
    const costTry = cost && rate ? roundHalfUp(mul(cost, rate.rate)) : null;
    const suggested = cost && rate ? suggestPrice(cost, rate.rate, rules) : null;
    const delta = suggested ? sub(suggested, current) : null;
    if (delta && !delta.isZero()) changed = true;
    lines[kind] = {
      kind,
      cost,
      costTry,
      current,
      suggested,
      delta,
      currentMarginPercent:
        costTry && current.gt(0) ? roundHalfUp(mul(div(sub(current, costTry), current), 100)) : null,
    };
  }

  return { id: tld.id, ext: tld.ext, isActive: tld.isActive, costCurrency: tld.costCurrency, rate, lines, changed };
}

/** Largest |change| % among the changing lines (auto-apply guard). */
export function maxChangePercent(suggestion: TldSuggestion): Prisma.Decimal {
  let maxPct = new Prisma.Decimal(0);
  for (const kind of TLD_PRICE_KINDS) {
    const line = suggestion.lines[kind];
    if (!line.delta || line.delta.isZero()) continue;
    // A price of 0 (never set) → any suggestion is "infinitely" large; treat as 100%+.
    const pct = line.current.gt(0) ? mul(div(line.delta.abs(), line.current), 100) : new Prisma.Decimal(1000);
    if (compare(pct, maxPct) > 0) maxPct = pct;
  }
  return maxPct;
}

const TLD_SELECT = {
  id: true,
  ext: true,
  isActive: true,
  registerPrice: true,
  renewPrice: true,
  transferPrice: true,
  costRegister: true,
  costRenew: true,
  costTransfer: true,
  costCurrency: true,
} as const;

/** Latest bulletin row of each cost currency used by the TLD list. */
async function latestRatesFor(currencies: string[]): Promise<{ rows: RateRow[]; day: string | null }> {
  const codes = [...new Set(currencies.map((c) => c.toUpperCase()).filter((c) => c !== "TRY"))];
  const rows: RateRow[] = [];
  for (const currency of codes) {
    const row = await db.exchangeRate.findFirst({
      where: { currency },
      orderBy: { date: "desc" },
      select: { currency: true, date: true, buying: true, selling: true },
    });
    if (row) rows.push({ ...row, date: row.date.toISOString().slice(0, 10) });
  }
  const day = rows.reduce<string | null>((latest, row) => (!latest || row.date > latest ? row.date : latest), null);
  return { rows, day };
}

export interface TldPricingOverview {
  rules: TldPricingRules;
  /** Day of the newest bulletin used ("YYYY-MM-DD"), null when no rate is stored. */
  rateDay: string | null;
  suggestions: TldSuggestion[];
}

/** Every TLD with its suggested prices at the latest stored rates. */
export async function getTldPricingOverview(): Promise<TldPricingOverview> {
  const [rules, tlds] = await Promise.all([
    getTldPricingRules(),
    db.domainTld.findMany({ select: TLD_SELECT, orderBy: [{ displayOrder: "asc" }, { ext: "asc" }] }),
  ]);
  const { rows, day } = await latestRatesFor(tlds.map((t) => t.costCurrency));
  // Each TLD uses the newest row of its own currency; "today" covers them all.
  const lookupDay = day ?? "9999-12-31";
  return {
    rules,
    rateDay: day,
    suggestions: tlds.map((tld) => buildTldSuggestion(tld, rows, lookupDay, rules)),
  };
}

export interface ApplyTldPricesInput {
  /** TLD ids to apply; omit for every TLD with a changed suggestion. */
  tldIds?: string[];
  actorId: string;
  source: "admin" | "auto";
  /**
   * Rate day the admin saw. If a newer bulletin arrived meanwhile the apply is
   * refused so nobody confirms prices they did not see.
   */
  expectedRateDay?: string | null;
}

export interface AppliedTldChange {
  ext: string;
  before: Record<TldPriceKind, string>;
  after: Record<TldPriceKind, string>;
  costCurrency: string;
  rate: string | null;
  rateDay: string | null;
}

export type ApplyTldPricesResult =
  | { ok: true; applied: AppliedTldChange[]; skipped: Array<{ ext: string; reason: string }> }
  | { ok: false; error: "RATE_CHANGED" | "NO_RATES" };

/**
 * Writes suggested prices (recomputed here — never trusts client values) and
 * one ActivityLog entry listing every before/after price. Lines without a
 * cost keep their current price.
 */
export async function applyTldSuggestedPrices(input: ApplyTldPricesInput): Promise<ApplyTldPricesResult> {
  const overview = await getTldPricingOverview();
  if (!overview.rateDay) return { ok: false, error: "NO_RATES" };
  if (input.expectedRateDay !== undefined && input.expectedRateDay !== overview.rateDay) {
    return { ok: false, error: "RATE_CHANGED" };
  }

  const wanted = input.tldIds ? new Set(input.tldIds) : null;
  const applied: AppliedTldChange[] = [];
  const skipped: Array<{ ext: string; reason: string }> = [];
  const updates: Array<{ id: string; data: Partial<Record<(typeof PRICE_FIELD)[TldPriceKind], Prisma.Decimal>> }> = [];

  for (const suggestion of overview.suggestions) {
    if (wanted && !wanted.has(suggestion.id)) continue;
    if (!suggestion.changed) continue;
    if (input.source === "auto") {
      const pct = maxChangePercent(suggestion);
      if (pct.gt(AUTO_APPLY_MAX_CHANGE_PERCENT)) {
        skipped.push({ ext: suggestion.ext, reason: `Değişim %${pct.toDecimalPlaces(1).toString()} > %${AUTO_APPLY_MAX_CHANGE_PERCENT}` });
        continue;
      }
    }

    const data: Partial<Record<(typeof PRICE_FIELD)[TldPriceKind], Prisma.Decimal>> = {};
    const before = {} as Record<TldPriceKind, string>;
    const after = {} as Record<TldPriceKind, string>;
    for (const kind of TLD_PRICE_KINDS) {
      const line = suggestion.lines[kind];
      before[kind] = line.current.toFixed(2);
      after[kind] = (line.suggested ?? line.current).toFixed(2);
      if (line.suggested && !line.suggested.eq(line.current)) data[PRICE_FIELD[kind]] = line.suggested;
    }
    updates.push({ id: suggestion.id, data });
    applied.push({
      ext: suggestion.ext,
      before,
      after,
      costCurrency: suggestion.costCurrency,
      rate: suggestion.rate ? suggestion.rate.rate.toString() : null,
      rateDay: suggestion.rate?.date ?? null,
    });
  }

  if (updates.length > 0) {
    await db.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.domainTld.update({ where: { id: update.id }, data: update.data });
      }
      await tx.activityLog.create({
        data: {
          userId: input.actorId,
          action: input.source === "auto" ? "tld.prices.auto_applied" : "tld.prices.applied",
          entity: "domain_tld",
          details: {
            rateDay: overview.rateDay,
            rules: {
              marginPercent: overview.rules.marginPercent,
              marginFixedTry: overview.rules.marginFixedTry,
              rounding: overview.rules.rounding,
            },
            changes: applied,
            skipped,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  return { ok: true, applied, skipped };
}
