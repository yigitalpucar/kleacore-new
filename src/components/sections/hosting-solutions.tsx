"use client";

import { useState } from "react";
import { ArrowRight, Zap, Globe, Server, HardDrive, Mail, Link2, Cpu, Download, Lock, Database, Check, MapPin, Shield, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import Link from "next/link";
import { PricingCard, type HostingPlan } from "@/components/hosting/pricing-card";
import { BillingToggle } from "@/components/hosting/billing-toggle";
import { cn } from "@/lib/utils";

const vdsPlans = [
  {
    name: "VDS-1",
    cpu: "1 vCPU",
    ram: "2 GB",
    disk: "30 GB",
    traffic: "Paylaşımlı Trafik",
    port: "50 Gbps Port",
    monthlyPrice: 119.98,
    discountedMonthly: 99.99,
    yearlyPrice: 1007.83,
  },
  {
    name: "VDS-2",
    cpu: "2 vCPU",
    ram: "4 GB",
    disk: "50 GB",
    traffic: "Paylaşımlı Trafik",
    port: "50 Gbps Port",
    monthlyPrice: 167.98,
    discountedMonthly: 139.99,
    yearlyPrice: 1411.10,
    popular: true,
  },
  {
    name: "VDS-3",
    cpu: "3 vCPU",
    ram: "6 GB",
    disk: "60 GB",
    traffic: "Paylaşımlı Trafik",
    port: "50 Gbps Port",
    monthlyPrice: 215.98,
    discountedMonthly: 179.99,
    yearlyPrice: 1814.30,
  },
  {
    name: "VDS-4",
    cpu: "4 vCPU",
    ram: "8 GB",
    disk: "80 GB",
    traffic: "Paylaşımlı Trafik",
    port: "50 Gbps Port",
    monthlyPrice: 263.98,
    discountedMonthly: 219.99,
    yearlyPrice: 2217.50,
  },
];

const vdsFeatures = [
  { icon: Zap, text: "Anında Aktivasyon" },
  { icon: HardDrive, text: "NVMe Storage" },
  { icon: Globe, text: "Limitsiz Trafik" },
  { icon: MapPin, text: "İstanbul Lokasyon" },
  { icon: Shield, text: "%99.9 Uptime" },
  { icon: Check, text: "Ücretsiz Kurulum" },
  { icon: Headphones, text: "7/24 Destek" },
];

const plans: HostingPlan[] = [
  {
    sku: "HST-LNX-01",
    name: "Starter",
    badge: "BAŞLANGIÇ",
    description: "Kişisel siteler için",
    price: 49,
    yearlyPrice: 39,
    period: "ay",
    storage: "1 GB",
    bandwidth: "5 GB",
    websites: "1",
    emails: "2",
    features: [],
    popular: false,
    detailedFeatures: [
      { icon: Globe, label: "Web Sitesi", value: "1 Adet" },
      { icon: Link2, label: "Subdomain", value: "5 Adet" },
      { icon: HardDrive, label: "Disk Alanı", value: "1 GB SSD", highlight: true },
      { icon: Zap, label: "Trafik", value: "5 GB" },
      { icon: Mail, label: "E-Posta", value: "2 Adet" },
      { icon: Database, label: "MySQL", value: "1 Adet" },
      { icon: Lock, label: "Ücretsiz SSL", value: "Let's Encrypt" },
      { icon: Cpu, label: "CPU / RAM", value: "1 Core / 1 GB" },
      { icon: Download, label: "Yedekleme", value: "Haftalık" },
    ],
  },
  {
    sku: "HST-LNX-02",
    name: "Professional",
    description: "Büyüyen projeler için",
    price: 79,
    yearlyPrice: 63,
    period: "ay",
    storage: "2 GB",
    bandwidth: "10 GB",
    websites: "1",
    emails: "5",
    features: [],
    popular: true,
    detailedFeatures: [
      { icon: Globe, label: "Web Sitesi", value: "1 Adet" },
      { icon: Link2, label: "Subdomain", value: "5 Adet" },
      { icon: HardDrive, label: "Disk Alanı", value: "2 GB SSD", highlight: true },
      { icon: Zap, label: "Trafik", value: "10 GB" },
      { icon: Mail, label: "E-Posta", value: "5 Adet" },
      { icon: Database, label: "MySQL", value: "1 Adet" },
      { icon: Lock, label: "Ücretsiz SSL", value: "Let's Encrypt" },
      { icon: Cpu, label: "CPU / RAM", value: "1 Core / 1 GB" },
      { icon: Download, label: "Yedekleme", value: "Haftalık" },
    ],
  },
  {
    sku: "HST-LNX-03",
    name: "Business",
    badge: "İŞLETME",
    description: "KOBİ'ler için ideal",
    price: 119,
    yearlyPrice: 95,
    period: "ay",
    storage: "3 GB",
    bandwidth: "15 GB",
    websites: "1",
    emails: "10",
    features: [],
    popular: false,
    detailedFeatures: [
      { icon: Globe, label: "Web Sitesi", value: "1 Adet" },
      { icon: Link2, label: "Subdomain", value: "5 Adet" },
      { icon: HardDrive, label: "Disk Alanı", value: "3 GB SSD", highlight: true },
      { icon: Zap, label: "Trafik", value: "15 GB" },
      { icon: Mail, label: "E-Posta", value: "10 Adet" },
      { icon: Database, label: "MySQL", value: "1 Adet" },
      { icon: Lock, label: "Ücretsiz SSL", value: "Let's Encrypt" },
      { icon: Cpu, label: "CPU / RAM", value: "1 Core / 2 GB" },
      { icon: Download, label: "Yedekleme", value: "Haftalık" },
    ],
  },
  {
    sku: "HST-LNX-04",
    name: "Enterprise",
    badge: "KURUMSAL",
    description: "Yoğun trafik için",
    price: 179,
    yearlyPrice: 143,
    period: "ay",
    storage: "5 GB",
    bandwidth: "25 GB",
    websites: "1",
    emails: "20",
    features: [],
    popular: false,
    detailedFeatures: [
      { icon: Globe, label: "Web Sitesi", value: "1 Adet" },
      { icon: Link2, label: "Subdomain", value: "10 Adet" },
      { icon: HardDrive, label: "Disk Alanı", value: "5 GB SSD", highlight: true },
      { icon: Zap, label: "Trafik", value: "25 GB" },
      { icon: Mail, label: "E-Posta", value: "20 Adet" },
      { icon: Database, label: "MySQL", value: "3 Adet" },
      { icon: Lock, label: "Ücretsiz SSL", value: "Let's Encrypt" },
      { icon: Cpu, label: "CPU / RAM", value: "2 Core / 4 GB" },
      { icon: Download, label: "Yedekleme", value: "Günlük" },
    ],
  },
];

export function HostingSolutions() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      {/* Background Grid */}
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

        {/* Billing Toggle */}
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

        {/* Pricing Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <PricingCard key={plan.name} plan={plan} isYearly={isYearly} />
            ))}
          </div>
        </motion.div>

        {/* Additional Info */}
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

        {/* VDS Servers Section */}
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

          {/* VDS Features */}
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

          {/* VDS Pricing Table */}
          <Card className="max-w-5xl mx-auto overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-7 gap-4 p-4 bg-muted/50 border-b text-sm font-medium text-muted-foreground">
              <div>Paket</div>
              <div className="text-center">Core</div>
              <div className="text-center">Bellek</div>
              <div className="text-center">Disk</div>
              <div className="text-center">Trafik</div>
              <div className="text-right">Fiyat</div>
              <div></div>
            </div>

            {/* Table Body */}
            <CardContent className="p-0">
              {vdsPlans.map((plan) => {
                const price = isYearly ? (plan.yearlyPrice / 12) : plan.discountedMonthly;
                const originalPrice = isYearly ? (plan.yearlyPrice / 12 * 1.16) : plan.monthlyPrice;

                return (
                  <div
                    key={plan.name}
                    className={cn(
                      "grid grid-cols-7 items-center gap-4 p-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors",
                      plan.popular && "bg-primary/5"
                    )}
                  >
                    {/* Paket */}
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

                    {/* Core */}
                    <div className="text-center">
                      <p className="font-semibold">{plan.cpu}</p>
                      <p className="text-xs text-muted-foreground">İşlemci</p>
                    </div>

                    {/* Bellek */}
                    <div className="text-center">
                      <p className="font-semibold">{plan.ram}</p>
                      <p className="text-xs text-muted-foreground">DDR4</p>
                    </div>

                    {/* Disk */}
                    <div className="text-center">
                      <p className="font-semibold">{plan.disk}</p>
                      <p className="text-xs text-muted-foreground">NVMe</p>
                    </div>

                    {/* Trafik */}
                    <div className="text-center">
                      <p className="font-semibold text-sm">{plan.traffic}</p>
                      <p className="text-xs text-muted-foreground">{plan.port}</p>
                    </div>

                    {/* Fiyat */}
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground line-through">
                        {originalPrice.toFixed(2)}₺/ay
                      </p>
                      <p className="font-bold text-lg">
                        {price.toFixed(2)}₺<span className="text-sm font-normal text-muted-foreground">/ay</span>
                      </p>
                    </div>

                    {/* Button */}
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

          {/* VDS Link */}
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
