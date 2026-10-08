import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { buttonClasses } from "@/components/site/button-classes";
import { CtaBand, type CtaBandProps } from "@/components/site/cta-band";
import { FaqSection, type FaqItem } from "@/components/site/faq-section";
import { PageHeader } from "@/components/site/page-header";
import type { PlanCardData } from "@/components/site/plan-card";
import { Price } from "@/components/site/price";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { TrustBar, type TrustBarItem } from "@/components/site/trust-bar";
import type { HostingComparisonData, HostingSubType } from "./data";
import { HostingPlans } from "./hosting-plans";
import { HostingSteps, type HostingStep } from "./hosting-steps";
import { HostingTypes } from "./hosting-types";

export interface HostingLandingProps {
  subType: HostingSubType;
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    breadcrumb: string;
  };
  trustItems: TrustBarItem[];
  plans: PlanCardData[];
  comparison: HostingComparisonData;
  plansHeading: { eyebrow: string; title: string; description?: string };
  /** Page-specific blocks rendered after the plans/comparison. */
  children?: React.ReactNode;
  steps: { eyebrow?: string; title: string; description?: string; items: HostingStep[] };
  startingPrices: Partial<Record<HostingSubType, number>>;
  faqs: FaqItem[];
  faqDescription?: string;
  cta: Pick<CtaBandProps, "eyebrow" | "title" | "description" | "primary" | "secondary">;
}

/**
 * Shared skeleton of the hosting landing pages. Each page supplies its own copy,
 * trust facts, page-specific sections (children), steps and FAQ.
 */
export function HostingLanding({
  subType,
  hero,
  trustItems,
  plans,
  comparison,
  plansHeading,
  children,
  steps,
  startingPrices,
  faqs,
  faqDescription,
  cta,
}: HostingLandingProps) {
  const from = startingPrices[subType];

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <PageHeader
          eyebrow={hero.eyebrow}
          title={hero.title}
          description={hero.description}
          breadcrumbs={[{ label: "Hosting", href: "/hosting/linux" }, { label: hero.breadcrumb }]}
          actions={
            <>
              <Link href="#paketler" className={buttonClasses({ size: "lg" })}>
                Paketleri incele
                <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link
                href="#paketler-karsilastirma"
                className={buttonClasses({ variant: "outline", size: "lg", className: "hidden md:inline-flex" })}
              >
                Karşılaştır
              </Link>
            </>
          }
        >
          {from ? (
            <p className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em]">Başlangıç</span>
              <Price amount={from} period="ay" size="sm" from className="text-foreground" />
            </p>
          ) : null}
        </PageHeader>

        <TrustBar items={trustItems} bordered={false} />

        <HostingPlans
          plans={plans}
          comparison={comparison}
          eyebrow={plansHeading.eyebrow}
          title={plansHeading.title}
          description={plansHeading.description}
        />

        {children}

        <Section tone="muted" divider aria-labelledby="baslangic-heading">
          <SectionHeading
            id="baslangic-heading"
            eyebrow={steps.eyebrow ?? "Nasıl başlarım"}
            title={steps.title}
            description={steps.description}
            className="mb-12"
          />
          <HostingSteps steps={steps.items} />
        </Section>

        <FaqSection items={faqs} description={faqDescription} divider />

        <Section divider aria-labelledby="diger-heading" spacing="sm">
          <SectionHeading
            id="diger-heading"
            eyebrow="Diğer hosting türleri"
            title="İhtiyacınız farklı mı?"
            className="mb-10"
          />
          <HostingTypes current={subType} startingPrices={startingPrices} />
        </Section>

        <CtaBand {...cta} />
      </main>
      <Footer />
    </div>
  );
}
