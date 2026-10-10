"use client";

import Link from "next/link";
import { BillingSwitch } from "@/components/site/billing-switch";
import { useBilling } from "@/components/site/billing-context";
import { buttonClasses } from "@/components/site/button-classes";
import { PackageComparison } from "@/components/site/package-comparison";
import { PlanGrid } from "@/components/site/plan-grid";
import type { PlanCardData } from "@/components/site/plan-card";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { savingsSummary } from "@/lib/catalog/package-comparison";
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
 * Plan grid + plan-by-plan comparison sharing the page's monthly/yearly
 * choice (BillingProvider). Prices, savings and the highlighted package all
 * come from the DB (yearly tier = monthly equivalent of yearly billing).
 */
export function HostingPlans({
  plans,
  comparison,
  eyebrow,
  title,
  description,
  comparisonTitle = "Paketleri karşılaştırın",
  comparisonDescription = "Tüm paket özellikleri yan yana. Değerler paket kayıtlarımızdan otomatik gelir.",
  id = "paketler",
}: HostingPlansProps) {
  const { billing, setBilling } = useBilling();
  const hasYearly = plans.some((plan) => plan.yearlyMonthlyPrice);
  const savings = savingsSummary(comparison.columns);
  const hrefOf = new Map(plans.map((plan) => [plan.id, plan.cta.href]));

  const billingSwitch = hasYearly ? (
    <BillingSwitch
      value={billing}
      onChange={setBilling}
      savingsPercent={savings.max}
      savingsVaries={!savings.uniform}
    />
  ) : null;

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
        {billingSwitch ? <div className="mb-10">{billingSwitch}</div> : null}
        <PlanGrid plans={plans} billing={billing} onBillingChange={setBilling} showSwitch={false} />
      </Section>

      {comparison.rows.length > 0 && comparison.columns.length > 1 ? (
        <Section
          id={`${id}-karsilastirma`}
          tone="muted"
          divider
          aria-labelledby={`${id}-karsilastirma-heading`}
          className="scroll-mt-24"
        >
          <SectionHeading
            id={`${id}-karsilastirma-heading`}
            eyebrow="Karşılaştırma"
            title={comparisonTitle}
            description={comparisonDescription}
            actions={billingSwitch}
            className="mb-10"
          />
          <PackageComparison
            data={comparison}
            billing={billing}
            caption={comparisonTitle}
            renderAction={(col, size) => {
              const href = hrefOf.get(col.key);
              if (!href) return null;
              return (
                <Link
                  href={href}
                  className={buttonClasses({
                    variant: col.featured ? "primary" : "outline",
                    size: "sm",
                    className: size === "sm" ? "min-h-10 w-full px-2" : "min-h-10 w-full",
                  })}
                  aria-label={`${col.label} paketini seç`}
                >
                  Seç
                </Link>
              );
            }}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            {billing === "yearly" ? "Yıllık ödemede aylık karşılığı ve yıllık toplam gösterilir. " : ""}
            Fiyatlara KDV dahil değildir. %20 KDV ödeme adımında eklenir.
          </p>
        </Section>
      ) : null}
    </>
  );
}
