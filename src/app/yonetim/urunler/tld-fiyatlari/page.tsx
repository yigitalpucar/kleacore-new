import type { Metadata } from "next";
import { FX_CURRENCIES } from "@/lib/fx/tcmb";
import { getLatestRates } from "@/lib/fx/rates";
import { TLD_PRICE_KINDS, getTldPricingOverview } from "@/lib/fx/tld-pricing";
import { toNumber, toNumberOrNull } from "@/lib/money";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { TldPricingContent, type TldPriceRow } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "TLD fiyatları" };

export default async function TldPricingPage() {
  await requireAdmin();
  const [overview, latest] = await Promise.all([getTldPricingOverview(), getLatestRates(FX_CURRENCIES)]);

  const rows: TldPriceRow[] = overview.suggestions.map((s) => ({
    id: s.id,
    ext: s.ext,
    isActive: s.isActive,
    costCurrency: s.costCurrency,
    rate: s.rate ? s.rate.rate.toNumber() : null,
    rateDay: s.rate?.date ?? null,
    changed: s.changed,
    lines: Object.fromEntries(
      TLD_PRICE_KINDS.map((kind) => {
        const line = s.lines[kind];
        return [
          kind,
          {
            cost: line.cost ? line.cost.toNumber() : null,
            costTry: toNumberOrNull(line.costTry),
            current: toNumber(line.current),
            suggested: toNumberOrNull(line.suggested),
            delta: toNumberOrNull(line.delta),
            currentMarginPercent: toNumberOrNull(line.currentMarginPercent),
          },
        ];
      })
    ) as TldPriceRow["lines"],
  }));

  const rates = FX_CURRENCIES.map((currency) => {
    const row = latest.get(currency);
    return {
      currency,
      date: row?.date ?? null,
      buying: row ? row.buying.toNumber() : null,
      selling: row ? row.selling.toNumber() : null,
      banknoteSelling: row?.banknoteSelling ? row.banknoteSelling.toNumber() : null,
    };
  });

  return (
    <TldPricingContent
      rows={rows}
      rates={rates}
      rateDay={overview.rateDay}
      rules={{
        marginPercent: overview.rules.marginPercent,
        marginFixedTry: overview.rules.marginFixedTry,
        rounding: overview.rules.rounding,
        autoApply: overview.rules.autoApply,
        updatedAt: overview.rules.updatedAt ?? null,
      }}
    />
  );
}
