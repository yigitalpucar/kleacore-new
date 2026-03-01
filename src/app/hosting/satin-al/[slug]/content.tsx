"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { StepDomain } from "@/components/hosting/onboarding/step-domain";
import { StepAddons } from "@/components/hosting/onboarding/step-addons";
import { StepSummary } from "@/components/hosting/onboarding/step-summary";
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
}

const STEPS = [
  { label: "Domain", number: 1 },
  { label: "Ek Hizmetler", number: 2 },
  { label: "Sipariş Özeti", number: 3 },
];

export const Content = ({ product, addons }: ContentProps) => {
  const [step, setStep] = useState(1);
  const [domainChoice, setDomainChoice] = useState<DomainChoice>({ type: "later" });
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

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1 py-12 md:py-16">
        <div className="container max-w-3xl">
          {/* Product Title */}
          <h1 className="text-2xl font-bold text-center mb-2">{product.name}</h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            {product.shortDescription}
          </p>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-0 mb-10">
            {STEPS.map((s, i) => (
              <div key={s.number} className="flex items-center">
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
                {i < STEPS.length - 1 && (
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

          {/* Active Step */}
          {step === 1 && (
            <StepDomain
              domainChoice={domainChoice}
              onDomainChoice={setDomainChoice}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepAddons
              addons={addons}
              selectedAddons={selectedAddons}
              onSelectedAddons={setSelectedAddons}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <StepSummary
              product={product}
              domainChoice={domainChoice}
              selectedAddons={selectedAddons}
              onBack={() => setStep(2)}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};
