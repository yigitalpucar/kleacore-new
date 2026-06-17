"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BillingToggle } from "@/components/hosting/billing-toggle";
import { useCartStore } from "@/store/cart-store";
import { toast } from "@/lib/toast";
import { calculateConfigurationPrice } from "@/lib/products/configurator-pricing";
import type {
  ConfigurationSelections,
  ProductConfigOptionView,
} from "@/lib/products/configurator-types";
import type { Product, PricingTier, ProductCategory } from "@prisma/client";
import type { DomainChoice, SelectedAddon } from "@/app/hosting/satin-al/[slug]/content";

type ProductWithPricing = Product & {
  category: ProductCategory;
  pricingTiers: PricingTier[];
};

interface StepSummaryProps {
  product: ProductWithPricing;
  domainChoice: DomainChoice;
  selectedAddons: SelectedAddon[];
  configOptions: ProductConfigOptionView[];
  configSelections: ConfigurationSelections;
  onBack: () => void;
}

const TAX_RATE = 0.20;

export const StepSummary = ({
  product,
  domainChoice,
  selectedAddons,
  configOptions,
  configSelections,
  onBack,
}: StepSummaryProps) => {
  const [isYearly, setIsYearly] = useState(false);
  const addHostingBundle = useCartStore((s) => s.addHostingBundle);
  const router = useRouter();

  const monthlyTier = product.pricingTiers.find((t) => t.period === "monthly");
  const yearlyTier = product.pricingTiers.find((t) => t.period === "yearly");

  const hostingPrice = isYearly
    ? (yearlyTier?.discountedPrice ?? yearlyTier?.price ?? product.basePrice)
    : (monthlyTier?.price ?? product.basePrice);

  const addonTotal = selectedAddons.reduce(
    (sum, a) => sum + (isYearly ? a.yearlyPrice : a.monthlyPrice),
    0
  );

  const configPricing = useMemo(
    () =>
      calculateConfigurationPrice(
        configOptions,
        configSelections,
        isYearly ? "yearly" : "monthly"
      ),
    [configOptions, configSelections, isYearly]
  );

  const domainPrice = domainChoice.type === "new" ? (domainChoice.price ?? 0) : 0;

  const subtotal = hostingPrice + addonTotal + configPricing.total + domainPrice;
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  const handleAddToCart = () => {
    const added = addHostingBundle({
      sku: product.sku,
      title: product.name,
      price: hostingPrice,
      billingPeriod: isYearly ? "yearly" : "monthly",
      domainChoice,
      addons: selectedAddons,
      configuration: Object.keys(configSelections).length > 0 ? configSelections : undefined,
      configOptionTotal: configPricing.total,
    });

    if (added) {
      toast.success(`${product.name} sepete eklendi.`);
      router.push("/sepet");
    } else {
      toast.info("Bu ürün zaten sepetinizde.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Sipariş Özeti</h2>
        <p className="text-sm text-muted-foreground">
          Siparişinizi gözden geçirin ve onaylayın.
        </p>
      </div>

      <BillingToggle isYearly={isYearly} onToggle={setIsYearly} />

      <Card>
        <CardHeader className="pb-3">
          <h3 className="font-semibold">Sipariş Detayları</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>{product.name}</span>
            <span className="font-medium">₺{hostingPrice.toFixed(2)}/{isYearly ? "ay" : "ay"}</span>
          </div>

          {domainChoice.type === "new" && domainChoice.domain && (
            <div className="flex justify-between text-sm">
              <span>Domain: {domainChoice.domain}</span>
              <span className="font-medium">₺{domainPrice.toFixed(2)}/yıl</span>
            </div>
          )}
          {domainChoice.type === "existing" && domainChoice.domain && (
            <div className="flex justify-between text-sm">
              <span>Domain: {domainChoice.domain}</span>
              <span className="text-muted-foreground">Mevcut</span>
            </div>
          )}

          {configPricing.lines.map((line) => (
            <div key={line.slug} className="flex justify-between text-sm">
              <span>
                {line.name}: {line.label}
              </span>
              <span className="font-medium">₺{line.price.toFixed(2)}</span>
            </div>
          ))}

          {selectedAddons.map((addon) => (
            <div key={addon.sku} className="flex justify-between text-sm">
              <span>{addon.name}</span>
              <span className="font-medium">
                ₺{(isYearly ? addon.yearlyPrice : addon.monthlyPrice).toFixed(2)}/ay
              </span>
            </div>
          ))}

          <Separator />

          <div className="flex justify-between text-sm">
            <span>Ara Toplam</span>
            <span>₺{subtotal.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-sm text-muted-foreground">
            <span>KDV (%{TAX_RATE * 100})</span>
            <span>₺{tax.toFixed(2)}</span>
          </div>

          <Separator />

          <div className="flex justify-between font-semibold text-lg">
            <span>Toplam</span>
            <span className="text-primary">₺{total.toFixed(2)}</span>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Button className="w-full" size="lg" onClick={handleAddToCart}>
            <ShoppingCart className="h-4 w-4 mr-2" />
            Sepete Ekle
          </Button>
        </CardFooter>
      </Card>

      <div className="flex justify-start">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri
        </Button>
      </div>
    </div>
  );
};