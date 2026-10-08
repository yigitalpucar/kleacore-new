"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Building2, Check, CreditCard, Loader2 } from "lucide-react";
import { AppBreadcrumbLabel, EmptyState, PageHeader, SectionCard, appButton } from "@/components/app";
import type { CustomerPaymentMethod } from "@/lib/payments/methods";
import { cn } from "@/lib/utils";
import { submitPlanChange } from "@/lib/actions/customer/plan-change";
import { handleCreditCardCheckoutRedirect } from "@/lib/payments/checkout-redirect";
import { toast } from "@/lib/toast";
import { formatTRY } from "@/lib/format/price";
import { billingPeriodLabel } from "@/lib/format/date";

interface PlanOption {
  id: string;
  name: string;
  sku: string;
  shortDescription: string;
  basePrice: number;
  displayOrder: number;
  proratedAmount: number;
  newPrice: number;
  priceDiff: number;
  remainingDays: number;
}

interface ServiceData {
  id: string;
  label: string;
  domain: string | null;
  amount: number;
  billingPeriod: string;
  nextDueDate: string | null;
  expiresAt: string | null;
  product: {
    id: string;
    name: string;
    sku: string;
    displayOrder: number;
    category: { slug: string; name: string } | null;
  };
  upgrades: PlanOption[];
  downgrades: PlanOption[];
}

interface ServicePlanChangeContentProps {
  service: ServiceData;
}

const money = (n: number) => formatTRY(n, { keepDecimals: true });

const paymentMethods = [
  { id: "credit-card", name: "Kredi kartı", icon: CreditCard },
  { id: "bank-transfer", name: "Banka havalesi", icon: Building2 },
];

export function ServicePlanChangeContent({ service }: ServicePlanChangeContentProps) {
  const router = useRouter();
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState("credit-card");
  const [isProcessing, setIsProcessing] = useState(false);

  const allOptions = [
    ...service.upgrades.map((option) => ({ ...option, type: "upgrade" as const })),
    ...service.downgrades.map((option) => ({ ...option, type: "downgrade" as const })),
  ];

  const selectedOption = allOptions.find((option) => option.sku === selectedSku) ?? null;
  const isDowngrade = selectedOption?.type === "downgrade";
  const chargeAmount = selectedOption ? Math.max(0, selectedOption.proratedAmount) : 0;
  const periodLabel = billingPeriodLabel(service.billingPeriod).toLocaleLowerCase("tr-TR");

  const handleSubmit = async () => {
    if (!selectedSku || isProcessing) return;

    setIsProcessing(true);

    const paymentMethod: CustomerPaymentMethod | undefined = isDowngrade
      ? undefined
      : selectedPayment === "bank-transfer"
        ? "BANK_TRANSFER"
        : "CREDIT_CARD";

    const result = await submitPlanChange({
      serviceId: service.id,
      targetProductSku: selectedSku,
      paymentMethod,
    });

    if (!result.success) {
      toast.error(result.error ?? "Paket değişikliği talebi oluşturulamadı");
      setIsProcessing(false);
      return;
    }

    if (
      result.data &&
      "checkoutUrl" in result.data &&
      handleCreditCardCheckoutRedirect(
        {
          checkoutUrl: result.data.checkoutUrl,
          checkoutHtml: result.data.checkoutHtml,
          paytrToken: result.data.paytrToken,
        },
        router
      )
    ) {
      return;
    }

    toast.success(result.message ?? "Talebiniz alındı");
    router.push(`/musteri/panel/hizmetlerim/${service.id}`);
    router.refresh();
  };

  const renderOption = (option: PlanOption & { type: "upgrade" | "downgrade" }) => {
    const isSelected = selectedSku === option.sku;
    const isUpgrade = option.type === "upgrade";
    const Icon = isUpgrade ? ArrowUp : ArrowDown;

    return (
      <button
        key={option.sku}
        type="button"
        role="radio"
        aria-checked={isSelected}
        onClick={() => setSelectedSku(option.sku)}
        className={cn(
          "flex w-full items-start gap-3 rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isSelected ? "border-foreground bg-muted/50 ring-1 ring-foreground" : "hover:bg-muted/40"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
            isSelected && "border-foreground bg-foreground text-background"
          )}
        >
          {isSelected ? <Check className="size-3" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-medium">
            <Icon aria-hidden className="size-3.5 text-muted-foreground" />
            {option.name}
          </span>
          {option.shortDescription ? (
            <span className="mt-1 block text-sm text-muted-foreground">{option.shortDescription}</span>
          ) : null}
          <span className="mt-2 block text-xs text-muted-foreground">
            Yeni dönem fiyatı: <span className="tabular-nums">{money(option.newPrice)}</span> / {periodLabel}
          </span>
        </span>
        <span className="shrink-0 text-right">
          {isUpgrade ? (
            <>
              <span className="block font-semibold tabular-nums">{money(Math.max(0, option.proratedAmount))}</span>
              <span className="block text-xs text-muted-foreground">orantılı fark</span>
            </>
          ) : (
            <>
              <span className="block text-sm font-medium">Onay gerekir</span>
              <span className="block text-xs text-muted-foreground">ücretsiz düşürme</span>
            </>
          )}
        </span>
      </button>
    );
  };

  return (
    <>
      <AppBreadcrumbLabel segment={service.id} label={service.product.name} />

      <PageHeader
        back={{ href: `/musteri/panel/hizmetlerim/${service.id}`, label: service.product.name }}
        title="Paket değiştir"
        description={`${service.product.name} · ${service.domain || service.label || "—"}`}
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {service.upgrades.length > 0 ? (
            <SectionCard
              title="Yükseltme seçenekleri"
              description="Üst pakete geçişte kalan süre için orantılı fark tahsil edilir."
            >
              <div role="radiogroup" aria-label="Yükseltme seçenekleri" className="space-y-2">
                {service.upgrades.map((option) => renderOption({ ...option, type: "upgrade" }))}
              </div>
            </SectionCard>
          ) : null}

          {service.downgrades.length > 0 ? (
            <SectionCard title="Düşürme seçenekleri" description="Alt pakete geçiş yönetici onayıyla uygulanır.">
              <div role="radiogroup" aria-label="Düşürme seçenekleri" className="space-y-2">
                {service.downgrades.map((option) => renderOption({ ...option, type: "downgrade" }))}
              </div>
            </SectionCard>
          ) : null}

          {allOptions.length === 0 ? (
            <EmptyState
              icon={ArrowUpDown}
              title="Uygun paket bulunamadı"
              description="Bu hizmet için şu anda geçiş yapılabilecek başka bir paket yok."
            />
          ) : null}

          {selectedOption && !isDowngrade ? (
            <SectionCard title="Ödeme yöntemi">
              <div role="radiogroup" aria-label="Ödeme yöntemi" className="grid gap-2 sm:grid-cols-2">
                {paymentMethods.map((method) => {
                  const selected = selectedPayment === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSelectedPayment(method.id)}
                      className={cn(
                        "flex min-h-[52px] items-center gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "border-foreground bg-muted/50 ring-1 ring-foreground" : "hover:bg-muted/40"
                      )}
                    >
                      <method.icon aria-hidden className="size-4 text-muted-foreground" />
                      <span className="flex-1 text-sm font-medium">{method.name}</span>
                      {selected ? <Check aria-hidden className="size-4" /> : null}
                    </button>
                  );
                })}
              </div>
            </SectionCard>
          ) : null}
        </div>

        <SectionCard title="Özet" className="lg:sticky lg:top-20">
          <div className="space-y-2">
            <div className="rounded-md border p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Mevcut paket</p>
              <p className="mt-1 text-sm font-medium">{service.product.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {money(service.amount)} / {periodLabel}
              </p>
            </div>
            {selectedOption ? (
              <div className="rounded-md border border-foreground/40 p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Yeni paket</p>
                <p className="mt-1 text-sm font-medium">{selectedOption.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {money(selectedOption.newPrice)} / {periodLabel}
                </p>
              </div>
            ) : null}
          </div>

          {selectedOption ? (
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Kalan gün</dt>
                <dd className="tabular-nums">{selectedOption.remainingDays} gün</dd>
              </div>
              {!isDowngrade ? (
                <div className="flex items-baseline justify-between gap-3 border-t border-dashed pt-2">
                  <dt className="font-medium">Ödenecek</dt>
                  <dd className="text-xl font-semibold tabular-nums tracking-tight">{money(chargeAmount)}</dd>
                </div>
              ) : (
                <p className="rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
                  Düşürme talebi yönetici onayından sonra uygulanır.
                </p>
              )}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Devam etmek için bir paket seçin.</p>
          )}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!selectedSku || isProcessing}
            className={appButton({ className: "mt-4 w-full md:h-10" })}
          >
            {isProcessing ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {isProcessing ? "İşleniyor…" : isDowngrade ? "Düşürme talebi gönder" : "Yükseltmeyi tamamla"}
          </button>
        </SectionCard>
      </div>
    </>
  );
}
