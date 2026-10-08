"use client";

import { useState } from "react";
import { BillingSwitch } from "@/components/site/billing-switch";
import { ComparisonTable } from "@/components/site/comparison-table";
import { PlanGrid } from "@/components/site/plan-grid";
import type { PlanCardData } from "@/components/site/plan-card";
import { Price } from "@/components/site/price";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { maxYearlySavings, type BillingPeriod } from "@/lib/format/price";
import type { HostingComparisonData } from "./data";

interface HostingPlansProps {
  plans: PlanCardData[];
  comparison: HostingComparisonData;
  /** Plans section heading. */
  eyebrow: string;
  title: string;
  description?: string;
  /** Comparison section heading. */
  comparisonTitle?: string;
  comparisonDescription?: string;
  /** Section ids (anchor targets). */
  id?: string;
}

/**
 * Plan grid + plan-by-plan comparison sharing one monthly/yearly switch.
 * Prices come from the DB (yearly tier = monthly equivalent of yearly billing).
 */
export function HostingPlans({
  plans,
  comparison,
  eyebrow,
  title,
  description,
  comparisonTitle = "Paketleri karşılaştırın",
  comparisonDescription = "Tüm paket özellikleri tek tabloda. Değerler paket kayıtlarımızdan otomatik gelir.",
  id = "paketler",
}: HostingPlansProps) {
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const hasYearly = plans.some((plan) => plan.yearlyMonthlyPrice);
  const byId = new Map(plans.map((plan) => [plan.id, plan]));

  const columns = comparison.columns.map((col) => {
    const plan = byId.get(col.key);
    const amount =
      plan && billing === "yearly" && plan.yearlyMonthlyPrice
        ? plan.yearlyMonthlyPrice
        : plan?.monthlyPrice;
    return {
      ...col,
      footer: amount ? <Price amount={amount} period="ay" size="sm" vatNote={false} /> : null,
    };
  });

  return (
    <>
      <Section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
        <SectionHeading
          id={`${id}-heading`}
          align="center"
          eyebrow={eyebrow}
          title={title}
          description={description}
          className="mb-10"
        />
        {hasYearly ? (
          <BillingSwitch
            value={billing}
            onChange={setBilling}
            savingsPercent={maxYearlySavings(plans)}
            className="mb-10"
          />
        ) : null}
        <PlanGrid plans={plans} billing={billing} onBillingChange={setBilling} showSwitch={false} />
      </Section>

      {comparison.rows.length > 0 && comparison.columns.length > 1 ? (
        <Section
          id={`${id}-karsilastirma`}
          tone="muted"
          divider
          aria-labelledby={`${id}-karsilastirma-heading`}
          // Plan cards already list every spec on phones; the table adds value from md up.
          className="hidden scroll-mt-24 md:block"
        >
          <SectionHeading
            id={`${id}-karsilastirma-heading`}
            eyebrow="Karşılaştırma"
            title={comparisonTitle}
            description={comparisonDescription}
            actions={
              hasYearly ? (
                <BillingSwitch
                  value={billing}
                  onChange={setBilling}
                  savingsPercent={maxYearlySavings(plans)}
                />
              ) : null
            }
            className="mb-10"
          />
          <ComparisonTable
            columns={columns}
            rows={comparison.rows}
            caption={comparisonTitle}
            footerLabel={billing === "yearly" ? "Aylık karşılığı (yıllık ödeme)" : "Aylık fiyat"}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            Fiyatlara KDV dahil değildir. %20 KDV ödeme adımında eklenir.
          </p>
        </Section>
      ) : null}
    </>
  );
}
