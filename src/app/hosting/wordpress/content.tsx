"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PricingCard, type HostingPlan } from "@/components/hosting/pricing-card";
import { BillingToggle } from "@/components/hosting/billing-toggle";
import { HostingFeatures } from "@/components/hosting/hosting-features";
import { BlurFade } from "@/components/magicui/blur-fade";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getIcon } from "@/lib/utils/icon-map";
import type { Product, PricingTier, ProductCategory } from "@prisma/client";

type ProductWithPricing = Product & {
  category: ProductCategory;
  pricingTiers: PricingTier[];
};

interface ContentProps {
  products: ProductWithPricing[];
}

interface FaqItem {
  question: string;
  answer: string;
}

interface FeatureItem {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}

const mapProductToHostingPlan = (product: ProductWithPricing): HostingPlan => {
  const monthlyTier = product.pricingTiers.find((t) => t.period === "monthly");
  const yearlyTier = product.pricingTiers.find((t) => t.period === "yearly");
  const resources = product.resourceLimits as Record<string, string>;
  const features = product.features as unknown as FeatureItem[];

  return {
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    description: product.shortDescription,
    price: monthlyTier?.price ?? product.basePrice,
    yearlyPrice: yearlyTier?.discountedPrice ?? yearlyTier?.price,
    period: "ay",
    features: (product.includedFeatures as string[]) ?? [],
    storage: resources?.storage ?? "",
    bandwidth: resources?.bandwidth ?? "",
    websites: resources?.websites ?? "",
    emails: resources?.emails ?? "",
    popular: product.isPopular,
    badge: product.badge ?? undefined,
    detailedFeatures: features?.map((f) => ({
      icon: getIcon(f.icon),
      label: f.label,
      value: f.value,
      highlight: f.highlight,
    })),
  };
};

export const Content = ({ products }: ContentProps) => {
  const [isYearly, setIsYearly] = useState(false);

  const plans = products.map(mapProductToHostingPlan);

  const faqProduct = products.find(
    (p) => Array.isArray(p.faq) && (p.faq as unknown as FaqItem[]).length > 0
  );
  const faqs = (faqProduct?.faq as unknown as FaqItem[]) ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-12">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                  WordPress Hosting
                </h1>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                  WordPress için özel optimize edilmiş sunucular. Otomatik
                  güncellemeler, önbellekleme ve güvenlik dahil.
                </p>
                <BillingToggle
                  isYearly={isYearly}
                  onToggle={setIsYearly}
                  className="mt-8"
                />
              </div>
            </BlurFade>

            {/* Pricing Cards */}
            <BlurFade delay={0.2} inView>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
                {plans.map((plan) => (
                  <PricingCard key={plan.name} plan={plan} isYearly={isYearly} />
                ))}
              </div>
            </BlurFade>
          </div>
        </section>

        {/* Hosting Features */}
        <HostingFeatures />

        {/* FAQ */}
        {faqs.length > 0 && (
          <section className="py-16 md:py-24 bg-muted/30">
            <div className="container">
              <BlurFade delay={0.1} inView>
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    Sık Sorulan Sorular
                  </h2>
                  <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                    WordPress hosting hakkında merak edilenler
                  </p>
                </div>
              </BlurFade>

              <BlurFade delay={0.2} inView>
                <div className="max-w-3xl mx-auto">
                  <Accordion type="single" collapsible className="w-full">
                    {faqs.map((faq, index) => (
                      <AccordionItem key={index} value={`item-${index}`}>
                        <AccordionTrigger className="text-left">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </BlurFade>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};
