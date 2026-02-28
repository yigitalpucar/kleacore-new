"use client";

import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BlurFade } from "@/components/magicui/blur-fade";
import { DatacenterFeatures } from "@/components/veri-merkezi/datacenter-features";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Globe, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useCartStore } from "@/store/cart-store";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import type { Product, PricingTier, ProductCategory } from "@prisma/client";

type ProductWithPricing = Product & {
  category: ProductCategory;
  pricingTiers: PricingTier[];
};

interface ContentProps { products: ProductWithPricing[]; }
interface FaqItem { question: string; answer: string; }

export const Content = ({ products }: ContentProps) => {
  const addProduct = useCartStore((s) => s.addProduct);
  const router = useRouter();

  const plans = products.map((p) => {
    const res = p.resourceLimits as Record<string, string>;
    const monthly = p.pricingTiers.find((t) => t.period === "monthly");
    return {
      name: p.name, sku: p.sku, badge: p.badge, description: p.shortDescription,
      price: monthly?.price ?? p.basePrice, period: "ay",
      bandwidth: res?.bandwidth ?? "",
      popular: p.isPopular,
      features: (p.includedFeatures as string[]) ?? [],
    };
  });

  const faqProduct = products.find(
    (p) => Array.isArray(p.faq) && (p.faq as unknown as FaqItem[]).length > 0
  );
  const faqs = (faqProduct?.faq as unknown as FaqItem[]) ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1">
        <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm font-medium mb-4">
                  <Globe className="h-4 w-4 text-primary" />
                  Global İçerik Dağıtım Ağı
                </div>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">CDN Hizmeti</h1>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                  200+ lokasyonda içerik dağıtımı ile web sitenizi hızlandırın.
                  Düşük gecikme, yüksek performans ve güvenlik bir arada.
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
                {plans.map((plan) => (
                  <Card key={plan.name} className={`relative flex flex-col h-full transition-all hover:shadow-lg ${plan.popular ? "border-primary shadow-lg scale-[1.02] z-10" : ""}`}>
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                      {plan.popular ? (
                        <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">POPÜLER</span>
                      ) : plan.badge ? (
                        <span className="bg-muted text-muted-foreground text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap border">{plan.badge}</span>
                      ) : null}
                    </div>
                    {plan.popular && <BorderBeam size={200} duration={12} colorFrom="#3b82f6" colorTo="#8b5cf6" />}
                    <CardHeader className="text-center pt-6">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                      <div className="mt-4">
                        <span className="text-sm text-muted-foreground">₺</span>
                        <span className="text-4xl font-bold">{Number(plan.price)}</span>
                        <span className="text-muted-foreground text-sm">/{plan.period}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{plan.bandwidth} aylık trafik</p>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ul className="space-y-3">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary flex-shrink-0" /><span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <div className="p-6 pt-0">
                      <Button
                        className="w-full"
                        variant={plan.popular ? "default" : "outline"}
                        size="lg"
                        onClick={() => {
                          const added = addProduct({
                            type: "datacenter",
                            sku: plan.sku,
                            title: plan.name,
                            price: Number(plan.price),
                            billingPeriod: "monthly",
                            subType: "cdn",
                          });
                          if (added) {
                            toast.success(`${plan.name} sepete eklendi.`);
                            router.push("/sepet");
                          } else {
                            toast.info("Bu ürün zaten sepetinizde.");
                          }
                        }}
                      >Hemen Başla</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </BlurFade>
          </div>
        </section>

        <DatacenterFeatures />

        {faqs.length > 0 && (
          <section className="py-16 md:py-24 bg-muted/30">
            <div className="container">
              <BlurFade delay={0.1} inView>
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Sık Sorulan Sorular</h2>
                  <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">CDN hizmeti hakkında merak edilenler</p>
                </div>
              </BlurFade>
              <BlurFade delay={0.2} inView>
                <div className="max-w-3xl mx-auto">
                  <Accordion type="single" collapsible className="w-full">
                    {faqs.map((faq, i) => (
                      <AccordionItem key={i} value={`item-${i}`}>
                        <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
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
