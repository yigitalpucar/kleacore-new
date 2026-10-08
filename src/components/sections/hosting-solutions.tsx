"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { maxYearlySavings, type BillingPeriod } from "@/lib/format/price";
import { BillingSwitch } from "@/components/site/billing-switch";
import { PlanGrid } from "@/components/site/plan-grid";
import type { PlanCardData } from "@/components/site/plan-card";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { ServerPlanTable, type ServerPlanRow } from "@/components/site/server-plan-table";
import { buttonClasses } from "@/components/site/button-classes";

interface HostingSolutionsProps {
  /** Linux hosting plans (from `productToPlanCard`). */
  hostingPlans: PlanCardData[];
  /** VDS plans (from `productToServerRow`). */
  vdsPlans: ServerPlanRow[];
}

/**
 * Homepage pricing block: hosting cards + VDS table sharing one
 * monthly/yearly switch. All prices come from the DB.
 */
export function HostingSolutions({ hostingPlans, vdsPlans }: HostingSolutionsProps) {
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const savings = maxYearlySavings([...hostingPlans, ...vdsPlans]);

  return (
    <>
      <Section id="hosting" aria-labelledby="hosting-heading" divider>
        <SectionHeading
          id="hosting-heading"
          align="center"
          eyebrow="Linux hosting"
          title="Hosting paketleri"
          description="Tüm paketlerde cPanel, LiteSpeed web sunucu ve ücretsiz Let's Encrypt SSL. Paketler disk, trafik ve e-posta kotalarıyla ayrılır."
          className="mb-10"
        />
        <BillingSwitch value={billing} onChange={setBilling} savingsPercent={savings} className="mb-10" />
        <PlanGrid plans={hostingPlans} billing={billing} onBillingChange={setBilling} showSwitch={false} />
        <div className="mt-8 flex justify-center">
          <Link href="/hosting/linux" className={buttonClasses({ variant: "ghost" })}>
            Tüm özellikleri karşılaştır
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </Section>

      <Section id="vds" aria-labelledby="vds-heading" tone="muted" divider>
        <SectionHeading
          id="vds-heading"
          eyebrow="VDS sunucu"
          title="VDS sunucu paketleri"
          description="NVMe SSD disk, İstanbul lokasyon ve tam root erişimi. Fiyatlar seçili ödeme dönemine göre aylık karşılık olarak gösterilir."
          actions={
            <Link href="/sunucu/vds" className={buttonClasses({ variant: "outline" })}>
              Tüm VDS paketleri
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          }
          className="mb-10"
        />
        {vdsPlans.length > 0 ? (
          <ServerPlanTable plans={vdsPlans} billing={billing} caption="VDS sunucu paketleri" />
        ) : (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Şu anda satışta VDS paketi bulunmuyor.
          </p>
        )}
        <p className="mt-6 text-xs text-muted-foreground">
          {billing === "yearly" ? "Yıllık ödemede aylık karşılık. " : ""}
          Fiyatlara KDV dahil değildir.
        </p>
      </Section>
    </>
  );
}
