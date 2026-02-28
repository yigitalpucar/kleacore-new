"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BlurFade } from "@/components/magicui/blur-fade";
import { ServerFeatures } from "@/components/sunucu/server-features";
import { ServerFaq } from "@/components/sunucu/server-faq";
import { Cpu, HardDrive, Globe, Shield, Zap, Check, ChevronDown, Headphones, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cart-store";
import { toast } from "@/lib/toast";
import type { Product, PricingTier, ProductCategory } from "@prisma/client";

type ProductWithPricing = Product & { category: ProductCategory; pricingTiers: PricingTier[] };

interface ContentProps { products: ProductWithPricing[] }

interface ServerPlan { sku: string; name: string; cpu: string; ram: string; disk: string; traffic: string; port: string; monthlyPrice: number; discountedMonthly: number; yearlyPrice: number }

const mapProductToServerPlan = (product: ProductWithPricing): ServerPlan => {
  const res = product.resourceLimits as unknown as Record<string, string>;
  const monthly = product.pricingTiers.find((t) => t.period === "monthly");
  const yearly = product.pricingTiers.find((t) => t.period === "yearly");
  return {
    sku: product.sku, name: product.name, cpu: res?.cpu ?? "", ram: res?.ram ?? "", disk: res?.disk ?? "",
    traffic: res?.traffic ?? "", port: res?.port ?? "",
    monthlyPrice: monthly?.renewalPrice ?? monthly?.price ?? product.basePrice,
    discountedMonthly: monthly?.discountedPrice ?? monthly?.price ?? product.basePrice,
    yearlyPrice: (yearly?.price ?? monthly?.price ?? product.basePrice) * 12,
  };
};

const planFeatures = [
  { icon: Zap, text: "Anında Aktivasyon" }, { icon: HardDrive, text: "NVMe Storage" },
  { icon: Globe, text: "Sınırsız Trafik" }, { icon: MapPin, text: "İstanbul Lokasyon" },
  { icon: Cpu, text: "AMD EPYC" }, { icon: Shield, text: "%99.99 Uptime" },
  { icon: Check, text: "Ücretsiz Kurulum" }, { icon: Headphones, text: "7/24 Destek" },
];

const locations = [
  { id: "tr", name: "Türkiye", code: "tr" }, { id: "de", name: "Almanya", code: "de" },
  { id: "us", name: "Amerika", code: "us" }, { id: "nl", name: "Hollanda", code: "nl" },
];

const PlanRow = ({ plan, billingPeriod, isExpanded, onToggle, onAddToCart }: { plan: ServerPlan; billingPeriod: "monthly" | "yearly"; isExpanded: boolean; onToggle: () => void; onAddToCart: (plan: ServerPlan, price: number) => void }) => {
  const price = billingPeriod === "monthly" ? plan.discountedMonthly : (plan.yearlyPrice / 12);
  const originalPrice = billingPeriod === "monthly" ? plan.monthlyPrice : (plan.yearlyPrice / 12 * 1.16);
  return (
    <div className="border-b last:border-b-0">
      <div className="grid grid-cols-7 items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
        <div>
          <p className="font-bold">{plan.name}</p>
          <button onClick={onToggle} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
            Tüm Özellikleri Gör <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
          </button>
        </div>
        <div className="text-center"><p className="font-semibold">{plan.cpu}</p><p className="text-xs text-muted-foreground">İşlemci</p></div>
        <div className="text-center"><p className="font-semibold">{plan.ram}</p><p className="text-xs text-muted-foreground">DDR5</p></div>
        <div className="text-center"><p className="font-semibold">{plan.disk}</p><p className="text-xs text-muted-foreground">NVMe</p></div>
        <div className="text-center"><p className="font-semibold text-sm">{plan.traffic}</p><p className="text-xs text-muted-foreground">{plan.port}</p></div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground line-through">{originalPrice.toFixed(2)}₺/ay</p>
          <p className="font-bold text-lg">{price.toFixed(2)}₺<span className="text-sm font-normal text-muted-foreground">/ay</span></p>
        </div>
        <div className="text-right"><Button size="sm" className="px-6" onClick={() => onAddToCart(plan, price)}>Satın Al</Button></div>
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-2 bg-muted/20">
              <div className="grid grid-cols-4 gap-4">
                {planFeatures.map((f) => (<div key={f.text} className="flex items-center gap-2 text-sm"><f.icon className="h-4 w-4 text-primary" /><span>{f.text}</span></div>))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Content = ({ products }: ContentProps) => {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState("tr");
  const addServerPlan = useCartStore((s) => s.addServerPlan);
  const router = useRouter();
  const plans = products.map(mapProductToServerPlan);

  const handleAddToCart = (plan: ServerPlan, displayPrice: number) => {
    const added = addServerPlan({
      category: "cloud",
      planCode: plan.sku,
      title: plan.name,
      price: displayPrice,
      billingPeriod,
      location: selectedLocation,
    });
    if (added) {
      toast.success(`${plan.name} sepete eklendi.`);
      router.push("/sepet");
    } else {
      toast.info("Bu ürün zaten sepetinizde.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar /><Header />
      <main className="flex-1">
        <section className="py-16 md:py-24">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-12">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Bulut Sunucu Paketleri</h1>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">Esnek, ölçeklenebilir ve yüksek performanslı bulut sunucu çözümleri. İhtiyacınıza göre anında kaynak yönetimi.</p>
              </div>
            </BlurFade>
            <BlurFade delay={0.15} inView>
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-2 p-1 rounded-xl border bg-muted/50">
                  {locations.map((loc) => (
                    <button key={loc.id} onClick={() => setSelectedLocation(loc.id)} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all", selectedLocation === loc.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>
                      <span className={`fi fi-${loc.code} text-lg`} /><span className="hidden sm:inline">{loc.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </BlurFade>
            <BlurFade delay={0.2} inView>
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center rounded-full border p-1 bg-muted/50">
                  <button onClick={() => setBillingPeriod("monthly")} className={cn("px-6 py-2 rounded-full text-sm font-medium transition-all", billingPeriod === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>Aylık</button>
                  <button onClick={() => setBillingPeriod("yearly")} className={cn("px-6 py-2 rounded-full text-sm font-medium transition-all relative", billingPeriod === "yearly" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    Yıllık<span className="absolute -top-3 -right-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">%16 İndirim</span>
                  </button>
                </div>
              </div>
            </BlurFade>
            <BlurFade delay={0.2} inView>
              <Card className="max-w-6xl mx-auto overflow-hidden">
                <div className="grid grid-cols-7 gap-4 p-4 bg-muted/50 border-b text-sm font-medium text-muted-foreground">
                  <div>Paket</div><div className="text-center">Core</div><div className="text-center">Bellek</div><div className="text-center">Disk</div><div className="text-center">Trafik</div><div className="text-right">Fiyat</div><div></div>
                </div>
                <CardContent className="p-0">
                  {plans.map((plan) => (<PlanRow key={plan.name} plan={plan} billingPeriod={billingPeriod} isExpanded={expandedPlan === plan.name} onToggle={() => setExpandedPlan(expandedPlan === plan.name ? null : plan.name)} onAddToCart={handleAddToCart} />))}
                </CardContent>
              </Card>
            </BlurFade>
          </div>
        </section>
        <ServerFeatures /><ServerFaq />
      </main>
      <Footer />
    </div>
  );
};
