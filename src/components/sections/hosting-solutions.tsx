"use client";

import { useState } from "react";
import { ArrowRight, Zap, Server, HardDrive, Globe, Check, MapPin, Shield, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import Link from "next/link";
import { PricingCard, type HostingPlan } from "@/components/hosting/pricing-card";
import { BillingToggle } from "@/components/hosting/billing-toggle";
import { cn } from "@/lib/utils";
import type { ServerPlanView } from "@/lib/products/map-product";

const vdsFeatures = [
  { icon: Zap, text: "Anında Aktivasyon" },
  { icon: HardDrive, text: "NVMe Storage" },
  { icon: Globe, text: "Limitsiz Trafik" },
  { icon: MapPin, text: "İstanbul Lokasyon" },
  { icon: Shield, text: "%99.9 Uptime" },
  { icon: Check, text: "Ücretsiz Kurulum" },
  { icon: Headphones, text: "7/24 Destek" },
];

interface HostingSolutionsProps {
  linuxPlans: HostingPlan[];
  vdsPlans: ServerPlanView[];
}

export function HostingSolutions({ linuxPlans, vdsPlans }: HostingSolutionsProps) {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />

      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm font-medium mb-4">
            <Zap className="h-4 w-4 text-primary" />
            Yüksek Performans
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            En Uygun Hosting Çözümleri
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            İhtiyacınıza uygun paketi seçin, hemen başlayın.
            Tüm paketlerde <span className="text-foreground font-medium">30 gün para iade garantisi</span>.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          viewport={{ once: true }}
        >
          <BillingToggle
            isYearly={isYearly}
            onToggle={setIsYearly}
            className="mb-10"
          />
        </motion.div>

        {linuxPlans.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
              {linuxPlans.map((plan) => (
                <PricingCard key={plan.sku} plan={plan} isYearly={isYearly} />
              ))}
            </div>
          </motion.div>
        ) : (
          <p className="text-center text-muted-foreground">
            Henüz yayınlanmış hosting paketi yok. Yönetim panelinden ürün ekleyin.
          </p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-muted-foreground mb-4">
            Tüm paketlerde: Ücretsiz SSL, cPanel, 7/24 Destek, DDoS Koruması
          </p>
          <Button variant="link" asChild>
            <Link href="/hosting/linux" className="gap-2">
              Tüm hosting paketlerini karşılaştır
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mt-24"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm font-medium mb-4">
              <Server className="h-4 w-4 text-primary" />
              VDS Sunucular
            </div>
            <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Güçlü VDS Sunucu Paketleri
            </h3>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Yüksek performanslı VDS sunucularımız ile projelerinizi güçlendirin
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {vdsFeatures.map((feature) => (
              <div
                key={feature.text}
                className="flex items-center gap-2 text-sm bg-muted/50 px-4 py-2 rounded-full"
              >
                <feature.icon className="h-4 w-4 text-primary" />
                <span>{feature.text}</span>
              </div>
            ))}
          </div>

          {vdsPlans.length > 0 ? (
            <Card className="max-w-5xl mx-auto overflow-hidden">
              <div className="grid grid-cols-7 gap-4 p-4 bg-muted/50 border-b text-sm font-medium text-muted-foreground">
                <div>Paket</div>
                <div className="text-center">Core</div>
                <div className="text-center">Bellek</div>
                <div className="text-center">Disk</div>
                <div className="text-center">Trafik</div>
                <div className="text-right">Fiyat</div>
                <div></div>
              </div>

              <CardContent className="p-0">
                {vdsPlans.map((plan) => {
                  const price = isYearly ? plan.yearlyPrice / 12 : plan.discountedMonthly;
                  const originalPrice = isYearly
                    ? (plan.yearlyPrice / 12) * 1.16
                    : plan.monthlyPrice;

                  return (
                    <div
                      key={plan.sku}
                      className={cn(
                        "grid grid-cols-7 items-center gap-4 p-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors",
                        plan.popular && "bg-primary/5"
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold">{plan.name}</p>
                          {plan.popular && (
                            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                              Popüler
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold">{plan.cpu}</p>
                        <p className="text-xs text-muted-foreground">İşlemci</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold">{plan.ram}</p>
                        <p className="text-xs text-muted-foreground">DDR4</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold">{plan.disk}</p>
                        <p className="text-xs text-muted-foreground">NVMe</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-sm">{plan.traffic}</p>
                        <p className="text-xs text-muted-foreground">{plan.port}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground line-through">
                          {originalPrice.toFixed(2)}₺/ay
                        </p>
                        <p className="font-bold text-lg">
                          {price.toFixed(2)}₺
                          <span className="text-sm font-normal text-muted-foreground">/ay</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <Button size="sm" variant={plan.popular ? "default" : "outline"} asChild>
                          <Link href="/sunucu/vds">Satın Al</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : (
            <p className="text-center text-muted-foreground">
              Henüz yayınlanmış VDS paketi yok.
            </p>
          )}

          <div className="mt-6 text-center">
            <Button variant="link" asChild>
              <Link href="/sunucu/vds" className="gap-2">
                Tüm VDS paketlerini incele
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}