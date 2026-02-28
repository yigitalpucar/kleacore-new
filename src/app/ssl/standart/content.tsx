"use client";

import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SSLFeatures } from "@/components/ssl/ssl-features";
import { SSLFaq } from "@/components/ssl/ssl-faq";
import { BlurFade } from "@/components/magicui/blur-fade";
import {
  Shield,
  Lock,
  Check,
  ArrowRight,
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

const brands = [
  { name: "Sectigo", description: "Dünya lideri SSL sağlayıcısı" },
  { name: "GeoTrust", description: "DigiCert markası" },
  { name: "RapidSSL", description: "Hızlı ve ekonomik" },
  { name: "Thawte", description: "Kurumsal güven" },
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
        {/* Hero */}
        <section className="py-16 md:py-24">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border-primary/30 border px-4 py-1.5 text-sm font-medium text-primary mb-4">
                  <Lock className="h-4 w-4" />
                  Standart SSL Sertifikaları
                </div>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                  Standart SSL Sertifikaları
                </h1>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                  Web sitenizi HTTPS ile koruyun. Domain Validation (DV) ve
                  Organization Validation (OV) sertifikalarıyla güvenli bağlantı sağlayın.
                </p>
              </div>
            </BlurFade>

            {/* Plans */}
            <BlurFade delay={0.2} inView>
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
                            subType: "standart",
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

        {/* Features */}
        <SSLFeatures />

        {/* FAQ */}
        {faqs.length > 0 ? (
          <section className="py-16 md:py-24 bg-muted/30">
            <div className="container">
              <BlurFade delay={0.1} inView>
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    Sık Sorulan Sorular
                  </h2>
                  <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                    Standart SSL sertifikaları hakkında merak edilenler
                  </p>
                </div>
              </BlurFade>

              <BlurFade delay={0.2} inView>
                <div className="max-w-3xl mx-auto">
                  <SSLFaq />
                </div>
              </BlurFade>
            </div>
          </section>
        ) : (
          <SSLFaq />
        )}

        {/* Brands */}
        <section className="py-16 md:py-24">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Güvenilir Markalar
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Dünya genelinde tanınan sertifika otoritelerinden SSL
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl mx-auto">
                {brands.map((brand) => (
                  <Card key={brand.name} className="text-center hover:border-primary/50 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-bold text-primary mx-auto mb-3">
                        {brand.name.charAt(0)}
                      </div>
                      <h3 className="font-semibold">{brand.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {brand.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </BlurFade>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                  Hemen SSL Sertifikanızı Alın
                </h2>
                <p className="text-muted-foreground mb-8">
                  Web sitenizi güvence altına alın. Ziyaretçilerinize güvenli
                  bir deneyim sunun ve SEO sıralamanızı yükseltin.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" className="px-8">
                    SSL Satın Al
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" className="px-8">
                    Tüm SSL Seçenekleri
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
