"use client";

import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SSLFeatures } from "@/components/ssl/ssl-features";
import { SSLFaq } from "@/components/ssl/ssl-faq";
import { PageHero } from "@/components/sections/page-hero";
import { TrustStrip, sslTrustItems } from "@/components/sections/trust-strip";
import { BlurFade } from "@/components/magicui/blur-fade";
import {
  Shield,
  Lock,
  Check,
  ArrowRight,
  BadgeCheck,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/cart-store";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
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

const benefits = [
  {
    title: "Yeşil Adres Çubuğu",
    description: "Tarayıcıda şirket adınız görünür. Ziyaretçilerinize en üst düzey güven sağlayın.",
    icon: Shield,
  },
  {
    title: "Maksimum Güven",
    description: "EV SSL, web sitesi güvenliğinin en yüksek standardıdır. Müşterilerinizin güvenini kazanın.",
    icon: BadgeCheck,
  },
  {
    title: "Dönüşüm Artışı",
    description: "Araştırmalar EV SSL'in dönüşüm oranlarını %17'ye kadar artırdığını göstermektedir.",
    icon: TrendingUp,
  },
  {
    title: "Phishing Koruması",
    description: "Kapsamlı doğrulama süreci, sahte sitelerin EV SSL almasını engeller.",
    icon: Lock,
  },
];

const validationSteps = [
  {
    step: 1,
    title: "Başvuru",
    description: "EV SSL sertifikası için başvurunuzu yapın ve gerekli belgeleri hazırlayın.",
  },
  {
    step: 2,
    title: "Şirket Doğrulama",
    description: "Şirketinizin ticaret sicil kaydı ve yasal durumu doğrulanır.",
  },
  {
    step: 3,
    title: "Adres ve Telefon",
    description: "Fiziksel adresiniz ve telefon numaranız doğrulanır.",
  },
  {
    step: 4,
    title: "Operasyonel Doğrulama",
    description: "Şirketinizin aktif olarak faaliyet gösterdiği teyit edilir.",
  },
  {
    step: 5,
    title: "Sertifika Onayı",
    description: "Tüm doğrulamalar tamamlandıktan sonra sertifikanız aktif edilir.",
  },
];

export const Content = ({ products }: ContentProps) => {
  const addProduct = useCartStore((s) => s.addProduct);
  const router = useRouter();

  const plans = products.map((product) => {
    const resources = product.resourceLimits as Record<string, string>;
    const yearlyTier = product.pricingTiers.find((t) => t.period === "yearly");
    const displayPrice = yearlyTier?.price ?? product.basePrice;

    return {
      sku: product.sku,
      name: product.name,
      description: product.shortDescription,
      price: displayPrice,
      period: "yıl",
      validationTime: resources?.validationTime ?? "",
      popular: product.isPopular,
      features: (product.includedFeatures as string[]) ?? [],
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
        <PageHero
          badge="En Yüksek Güven Seviyesi"
          badgeIcon={Shield}
          title="EV (Extended Validation) SSL"
          description="Yeşil adres çubuğu ile maksimum müşteri güveni. E-ticaret ve finansal siteler için en yüksek güvenlik standardı."
          accent="amber"
        />

        <TrustStrip items={sslTrustItems} />

        <section className="py-12 md:py-16">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
                {plans.map((plan) => (
                  <Card
                    key={plan.name}
                    className={`relative flex flex-col ${
                      plan.popular ? "border-primary shadow-lg" : ""
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                          En Popüler
                        </span>
                      </div>
                    )}
                    <CardHeader className="text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
                        <Shield className="h-7 w-7 text-primary" />
                      </div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {plan.description}
                      </p>
                      <div className="mt-4">
                        <span className="text-4xl font-bold">₺{plan.price}</span>
                        <span className="text-muted-foreground">/{plan.period}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Doğrulama: {plan.validationTime}
                      </p>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ul className="space-y-3">
                        {plan.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="w-full mt-6"
                        variant={plan.popular ? "default" : "outline"}
                        onClick={() => {
                          const added = addProduct({
                            type: "ssl",
                            sku: plan.sku,
                            title: plan.name,
                            price: plan.price,
                            billingPeriod: "yearly",
                            subType: "ev",
                          });
                          if (added) {
                            toast.success(`${plan.name} sepete eklendi.`);
                            router.push("/sepet");
                          } else {
                            toast.info("Bu ürün zaten sepetinizde.");
                          }
                        }}
                      >
                        Satın Al
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </BlurFade>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 md:py-24">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Neden EV SSL?
                </h2>
                <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                  Extended Validation SSL, web güvenliğinin altın standardıdır
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <div className="grid gap-6 sm:grid-cols-2 max-w-4xl mx-auto">
                {benefits.map((benefit) => (
                  <Card key={benefit.title} className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-6 flex gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                        <benefit.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-1">
                          {benefit.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {benefit.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </BlurFade>
          </div>
        </section>

        {/* Validation Process */}
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  EV SSL Doğrulama Süreci
                </h2>
                <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                  Kapsamlı doğrulama ile en yüksek güvenlik standardını sağlıyoruz
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <div className="max-w-4xl mx-auto">
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border hidden md:block" />

                  <div className="space-y-6">
                    {validationSteps.map((item) => (
                      <div key={item.step} className="relative flex gap-4 md:gap-6">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg z-10">
                          {item.step}
                        </div>
                        <Card className="flex-1">
                          <CardContent className="p-4">
                            <h3 className="font-semibold mb-1">{item.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {item.description}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </BlurFade>
          </div>
        </section>

        {/* Features */}
        <SSLFeatures />

        {/* FAQ */}
        <SSLFaq />

        {/* CTA */}
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                  En Yüksek Güvenlik Standardını Seçin
                </h2>
                <p className="text-muted-foreground mb-8">
                  EV SSL ile müşterilerinize profesyonel ve güvenilir bir
                  deneyim sunun. Yeşil adres çubuğu ile farkınızı gösterin.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" className="px-8">
                    EV SSL Satın Al
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" className="px-8">
                    Satış Ekibiyle İletişim
                  </Button>
                </div>
              </div>
            </BlurFade>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};
