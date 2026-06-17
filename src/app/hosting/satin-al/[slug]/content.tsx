"use client";

import { useMemo, useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { StepDomain } from "@/components/hosting/onboarding/step-domain";
import { StepConfiguration } from "@/components/hosting/onboarding/step-configuration";
import { StepAddons } from "@/components/hosting/onboarding/step-addons";
import { StepSummary } from "@/components/hosting/onboarding/step-summary";
import type {
  ConfigurationSelections,
  ProductConfigOptionView,
} from "@/lib/products/configurator-types";
import type { Product, PricingTier, ProductCategory, ProductAddon } from "@prisma/client";

type ProductWithPricing = Product & {
  category: ProductCategory;
  pricingTiers: PricingTier[];
};

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
  addons: ProductAddon[];
  configOptions: ProductConfigOptionView[];
}

export const Content = ({ product, addons, configOptions }: ContentProps) => {
  const steps = useMemo(() => {
    const base = [{ key: "domain", label: "Domain" }];
    if (configOptions.length > 0) {
      base.push({ key: "configuration", label: "Yapılandırma" });
    }
    base.push({ key: "addons", label: "Ek Hizmetler" });
    base.push({ key: "summary", label: "Sipariş Özeti" });
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

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1 py-12 md:py-16">
        <div className="container max-w-3xl">
          <h1 className="text-2xl font-bold text-center mb-2">{product.name}</h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            {product.shortDescription}
          </p>

          <div className="flex items-center justify-center gap-0 mb-10">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center">
                <button
                  onClick={() => s.number < step && setStep(s.number)}
                  disabled={s.number > step}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                    s.number === step && "bg-primary text-primary-foreground",
                    s.number < step && "bg-primary/10 text-primary cursor-pointer",
                    s.number > step && "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {s.number < step ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="h-5 w-5 rounded-full border-2 border-current flex items-center justify-center text-xs">
                      {s.number}
                    </span>
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-8 md:w-12 h-0.5 mx-1",
                      s.number < step ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>

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
      </main>
      <Footer />
    </div>
  );
};