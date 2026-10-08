"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Check } from "lucide-react";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { Container } from "@/components/site/container";
import { Eyebrow } from "@/components/site/eyebrow";
import { GridBackground } from "@/components/site/grid-lines";
import { Price } from "@/components/site/price";
import { formatTRY, yearlySavingsPercent } from "@/lib/format/price";
import { getIcon } from "@/lib/utils/icon-map";
import { cn } from "@/lib/utils";
import { StepDomain } from "@/components/hosting/onboarding/step-domain";
import { StepConfiguration } from "@/components/hosting/onboarding/step-configuration";
import { StepAddons } from "@/components/hosting/onboarding/step-addons";
import { StepSummary } from "@/components/hosting/onboarding/step-summary";
import type {
  ConfigurationSelections,
  ProductConfigOptionView,
} from "@/lib/products/configurator-types";
import type { Product, PricingTier, ProductCategory, ProductAddon } from "@prisma/client";
import type { Serialized } from "@/lib/money";

/** Product as received from the server page: Decimal prices are numbers here. */
type ProductWithPricing = Serialized<
  Product & {
    category: ProductCategory;
    pricingTiers: PricingTier[];
  }
>;

export type AddonView = Serialized<ProductAddon>;

export interface DomainChoice {
  type: "new" | "existing" | "later";
  domain?: string;
  price?: number;
  renewPrice?: number;
}

export interface SelectedAddon {
  sku: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
}

interface ContentProps {
  product: ProductWithPricing;
  addons: AddonView[];
  configOptions: ProductConfigOptionView[];
}

export const Content = ({ product, addons, configOptions }: ContentProps) => {
  const steps = useMemo(() => {
    const base = [{ key: "domain", label: "Alan adı" }];
    if (configOptions.length > 0) {
      base.push({ key: "configuration", label: "Yapılandırma" });
    }
    base.push({ key: "addons", label: "Ek hizmetler" });
    base.push({ key: "summary", label: "Özet" });
    return base.map((step, index) => ({ ...step, number: index + 1 }));
  }, [configOptions.length]);

  const [step, setStep] = useState(1);
  const [domainChoice, setDomainChoice] = useState<DomainChoice>({ type: "later" });
  const [configSelections, setConfigSelections] = useState<ConfigurationSelections>({});
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>(() =>
    addons
      .filter((a) => a.isRequired)
      .map((a) => ({
        sku: a.sku,
        name: a.name,
        monthlyPrice: a.monthlyPrice,
        yearlyPrice: a.yearlyPrice,
      }))
  );

  const currentStep = steps[step - 1];

  // Bring the step content back into view when the step changes (presentational only).
  const stepTopRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const el = stepTopRef.current;
    if (el && el.getBoundingClientRect().top < 0) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [step]);
  const configurationStep = steps.find((item) => item.key === "configuration")?.number;
  const addonsStep = steps.find((item) => item.key === "addons")?.number;
  const summaryStep = steps.find((item) => item.key === "summary")?.number;

  const goToDomainNext = () => {
    if (configurationStep) {
      setStep(configurationStep);
      return;
    }
    if (addonsStep) {
      setStep(addonsStep);
    }
  };

  const goToConfigurationBack = () => setStep(1);
  const goToConfigurationNext = () => {
    if (addonsStep) {
      setStep(addonsStep);
    }
  };

  const goToAddonsBack = () => {
    if (configurationStep) {
      setStep(configurationStep);
      return;
    }
    setStep(1);
  };

  const goToSummaryBack = () => {
    if (addonsStep) {
      setStep(addonsStep);
    }
  };

  const subTypeInfo = SUB_TYPES[product.subType] ?? SUB_TYPES.linux;

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <section className="relative isolate overflow-hidden border-b">
          <GridBackground className="-z-10" />
          <Container className="py-10 md:py-14">
            <Breadcrumbs
              items={[
                { label: "Hosting", href: "/hosting/linux" },
                { label: subTypeInfo.label, href: subTypeInfo.href },
                { label: product.name },
              ]}
              className="mb-6"
            />
            <Eyebrow className="mb-3">Sipariş · {subTypeInfo.label}</Eyebrow>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              {product.name}
            </h1>
            {product.shortDescription ? (
              <p className="mt-3 max-w-2xl text-pretty text-base text-muted-foreground">
                {product.shortDescription}
              </p>
            ) : null}

            <nav aria-label="Sipariş adımları" className="mt-8">
              <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
                {steps.map((s, i) => {
                  const done = s.number < step;
                  const current = s.number === step;
                  return (
                    <li key={s.key} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => s.number < step && setStep(s.number)}
                        disabled={s.number > step}
                        aria-current={current ? "step" : undefined}
                        aria-label={`${s.number}. adım: ${s.label}${done ? " (tamamlandı)" : ""}`}
                        className={cn(
                          "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4",
                          current && "border-foreground bg-foreground text-background",
                          done && "bg-background text-foreground hover:bg-muted/60",
                          s.number > step && "cursor-not-allowed bg-background/60 text-muted-foreground"
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-5 items-center justify-center rounded-full font-mono text-[10px] tabular-nums",
                            current ? "bg-background/15" : "border"
                          )}
                        >
                          {done ? <Check className="size-3 stroke-[3]" /> : s.number}
                        </span>
                        <span className={cn(!current && "hidden sm:inline")}>{s.label}</span>
                      </button>
                      {i < steps.length - 1 ? (
                        <span aria-hidden className="line-dashed-x hidden w-6 sm:block md:w-10" />
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </nav>
          </Container>
        </section>

        <Container className="py-10 md:py-14">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
            <div ref={stepTopRef} className="min-w-0 scroll-mt-24">
              {currentStep?.key === "domain" && (
                <StepDomain
                  domainChoice={domainChoice}
                  onDomainChoice={setDomainChoice}
                  onNext={goToDomainNext}
                />
              )}
              {currentStep?.key === "configuration" && (
                <StepConfiguration
                  configOptions={configOptions}
                  selections={configSelections}
                  onSelectionsChange={setConfigSelections}
                  onNext={goToConfigurationNext}
                  onBack={goToConfigurationBack}
                />
              )}
              {currentStep?.key === "addons" && (
                <StepAddons
                  addons={addons}
                  selectedAddons={selectedAddons}
                  onSelectedAddons={setSelectedAddons}
                  onNext={() => summaryStep && setStep(summaryStep)}
                  onBack={goToAddonsBack}
                />
              )}
              {currentStep?.key === "summary" && (
                <StepSummary
                  product={product}
                  domainChoice={domainChoice}
                  selectedAddons={selectedAddons}
                  configOptions={configOptions}
                  configSelections={configSelections}
                  onBack={goToSummaryBack}
                />
              )}
            </div>
            <PlanAside product={product} />
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
};

const SUB_TYPES: Record<string, { label: string; href: string }> = {
  linux: { label: "Linux Hosting", href: "/hosting/linux" },
  wordpress: { label: "WordPress Hosting", href: "/hosting/wordpress" },
  kurumsal: { label: "Kurumsal Hosting", href: "/hosting/kurumsal" },
  reseller: { label: "Reseller Hosting", href: "/hosting/reseller" },
};

interface PlanFeature {
  label: string;
  value: string;
  icon?: string;
}

/** Selected plan recap (DB features and tier prices). Display only. */
function PlanAside({ product }: { product: ProductWithPricing }) {
  const monthly = product.pricingTiers.find((t) => t.period === "monthly");
  const yearly = product.pricingTiers.find((t) => t.period === "yearly");
  const monthlyPrice = monthly?.discountedPrice ?? monthly?.price ?? product.basePrice;
  const yearlyMonthly = yearly ? (yearly.discountedPrice ?? yearly.price) : null;
  const savings = yearlySavingsPercent(monthlyPrice, yearlyMonthly);
  const features = (product.features as unknown as PlanFeature[] | null) ?? [];

  return (
    <aside aria-labelledby="secilen-paket" className="lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-2xl bg-muted/60 p-1.5 ring-1 ring-border dark:bg-muted/30">
        <div className="rounded-xl bg-background px-5 py-5 shadow-[0_6px_10px_-6px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
          <Eyebrow>Seçilen paket</Eyebrow>
          <h2 id="secilen-paket" className="mt-3 text-lg font-semibold tracking-tight">
            {product.name}
          </h2>
          <div className="mt-4">
            <Price amount={monthlyPrice} period="ay" size="md" />
            {yearlyMonthly ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Yıllık ödemede aylık karşılığı {formatTRY(yearlyMonthly)}
                {savings > 0 ? ` · %${savings} tasarruf` : ""}
              </p>
            ) : null}
          </div>
        </div>
        {features.length > 0 ? (
          <dl className="space-y-2.5 px-5 py-5 text-sm">
            {features.map((feature) => {
              const Icon = getIcon(feature.icon ?? "");
              return (
                <div key={feature.label} className="flex items-center justify-between gap-4">
                  <dt className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <Icon aria-hidden className="size-4 shrink-0" />
                    <span className="truncate">{feature.label}</span>
                  </dt>
                  <dd className="text-right font-medium tabular-nums">
                    {feature.value === "✓" ? (
                      <>
                        <Check aria-hidden className="inline size-4" />
                        <span className="sr-only">Var</span>
                      </>
                    ) : (
                      feature.value
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : null}
      </div>
      <p className="mt-3 px-1 text-xs text-muted-foreground">
        Fiyatlara KDV dahil değildir. %20 KDV ödeme adımında eklenir.
      </p>
    </aside>
  );
}
