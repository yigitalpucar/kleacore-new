"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { buttonClasses } from "@/components/site/button-classes";
import { formatTRY, yearlySavingsPercent } from "@/lib/format/price";
import { cn } from "@/lib/utils";
import { StepHeading, StepNav } from "./step-shell";
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

  const savings = yearlySavingsPercent(
    monthlyTier?.price ?? product.basePrice,
    yearlyTier?.discountedPrice ?? yearlyTier?.price
  );
  const periodNote = isYearly ? "/ay · yıllık ödemede aylık karşılığı" : "/ay";

  return (
    <div className="space-y-8">
      <StepHeading
        eyebrow="Adım · Özet"
        title="Siparişinizi gözden geçirin"
        description="Ödeme dönemini seçin ve sepete ekleyin. Ödemeyi sepet adımında tamamlarsınız."
      />

      {yearlyTier ? (
        <BillingToggle
          isYearly={isYearly}
          onToggle={setIsYearly}
          savingsPercent={savings}
          className="items-start"
        />
      ) : null}

      <section
        aria-labelledby="siparis-detay"
        className="overflow-hidden rounded-2xl border bg-background"
      >
        <div className="border-b px-5 py-4">
          <h3 id="siparis-detay" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Sipariş detayları
          </h3>
        </div>
        <dl className="divide-y divide-dashed px-5 text-sm">
          <Row label={product.name} value={formatTRY(hostingPrice, { keepDecimals: true })} note={periodNote} strong />

          {domainChoice.type === "new" && domainChoice.domain && (
            <Row
              label={`Alan adı: ${domainChoice.domain}`}
              value={formatTRY(domainPrice, { keepDecimals: true })}
              note="/yıl"
            />
          )}
          {domainChoice.type === "existing" && domainChoice.domain && (
            <Row label={`Alan adı: ${domainChoice.domain}`} value="Mevcut" muted />
          )}
          {domainChoice.type === "later" && (
            <Row label="Alan adı" value="Sonra belirlenecek" muted />
          )}

          {configPricing.lines.map((line) => (
            <Row
              key={line.slug}
              label={`${line.name}: ${line.label}`}
              value={formatTRY(line.price, { keepDecimals: true })}
            />
          ))}

          {selectedAddons.map((addon) => (
            <Row
              key={addon.sku}
              label={addon.name}
              value={formatTRY(isYearly ? addon.yearlyPrice : addon.monthlyPrice, { keepDecimals: true })}
              note="/ay"
            />
          ))}
        </dl>

        <dl className="space-y-2 border-t bg-muted/30 px-5 py-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Ara toplam</dt>
            <dd className="tabular-nums">{formatTRY(subtotal, { keepDecimals: true })}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">KDV (%{TAX_RATE * 100})</dt>
            <dd className="tabular-nums">{formatTRY(tax, { keepDecimals: true })}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-dashed pt-3">
            <dt className="font-medium">Toplam</dt>
            <dd className="text-2xl font-semibold tabular-nums tracking-tight">
              {formatTRY(total, { keepDecimals: true })}
            </dd>
          </div>
        </dl>

        <div className="border-t p-5">
          <button
            type="button"
            onClick={handleAddToCart}
            className={buttonClasses({ size: "lg", className: "w-full" })}
          >
            <ShoppingCart aria-hidden className="size-4" />
            Sepete ekle
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Ödenecek tutar sepet ve ödeme adımında kesinleşir.
          </p>
        </div>
      </section>

      <StepNav onBack={onBack} />
    </div>
  );
};

function Row({
  label,
  value,
  note,
  strong = false,
  muted = false,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className={cn("min-w-0 break-words", strong ? "font-medium" : "text-foreground/90")}>{label}</dt>
      <dd className={cn("shrink-0 text-right tabular-nums", muted ? "text-muted-foreground" : "font-medium")}>
        {value}
        {note ? <span className="block text-xs font-normal text-muted-foreground">{note}</span> : null}
      </dd>
    </div>
  );
}
