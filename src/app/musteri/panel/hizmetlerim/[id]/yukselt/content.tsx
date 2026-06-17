"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  CreditCard,
  Building2,
  CheckCircle2,
  Shield,
  Loader2,
} from "lucide-react";
import type { CustomerPaymentMethod } from "@/lib/payments/methods";
import { cn } from "@/lib/utils";
import { submitPlanChange } from "@/lib/actions/customer/plan-change";
import { handleCreditCardCheckoutRedirect } from "@/lib/payments/checkout-redirect";
import { toast } from "@/lib/toast";

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

const billingPeriodLabels: Record<string, string> = {
  monthly: "Aylık",
  quarterly: "3 Aylık",
  semiannual: "6 Aylık",
  yearly: "Yıllık",
  biennial: "2 Yıllık",
  triennial: "3 Yıllık",
};

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

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
  const chargeAmount = selectedOption
    ? Math.max(0, selectedOption.proratedAmount)
    : 0;

  const paymentMethods = [
    { id: "credit-card", name: "Kredi Kartı", icon: CreditCard },
    { id: "bank-transfer", name: "Banka Havalesi", icon: Building2 },
  ];

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

  const renderOptionCard = (
    option: PlanOption & { type: "upgrade" | "downgrade" }
  ) => {
    const isSelected = selectedSku === option.sku;
    const isUpgrade = option.type === "upgrade";

    return (
      <div
        key={option.sku}
        onClick={() => setSelectedSku(option.sku)}
        className={cn(
          "relative p-4 rounded-lg border-2 cursor-pointer transition-all",
          isSelected
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {isUpgrade ? (
                <ArrowUp className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDown className="h-4 w-4 text-orange-500" />
              )}
              <p className="font-semibold">{option.name}</p>
            </div>
            {option.shortDescription && (
              <p className="text-sm text-muted-foreground mt-1">{option.shortDescription}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Yeni dönem fiyatı: {currencyFormatter.format(option.newPrice)} /{" "}
              {billingPeriodLabels[service.billingPeriod] || service.billingPeriod}
            </p>
          </div>
          <div className="text-right">
            {isUpgrade ? (
              <>
                <p className="text-lg font-bold text-primary">
                  {currencyFormatter.format(Math.max(0, option.proratedAmount))}
                </p>
                <p className="text-xs text-muted-foreground">orantılı fark</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-orange-500">Onay gerekir</p>
                <p className="text-xs text-muted-foreground">ücretsiz düşürme</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <BlurFade delay={0.1} inView>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/musteri/panel/hizmetlerim/${service.id}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Paket Değiştir</h1>
            <p className="text-muted-foreground">
              {service.product.name} - {service.domain || service.label || "-"}
            </p>
          </div>
        </div>
      </BlurFade>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {service.upgrades.length > 0 && (
            <BlurFade delay={0.15} inView>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowUp className="h-5 w-5 text-green-500" />
                    Yükseltme Seçenekleri
                  </CardTitle>
                  <CardDescription>
                    Daha üst paketlere geçiş yapın; kalan süre için orantılı fark tahsil edilir
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {service.upgrades.map((option) =>
                    renderOptionCard({ ...option, type: "upgrade" })
                  )}
                </CardContent>
              </Card>
            </BlurFade>
          )}

          {service.downgrades.length > 0 && (
            <BlurFade delay={0.2} inView>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowDown className="h-5 w-5 text-orange-500" />
                    Düşürme Seçenekleri
                  </CardTitle>
                  <CardDescription>
                    Alt paketlere geçiş için yönetici onayı gerekir
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {service.downgrades.map((option) =>
                    renderOptionCard({ ...option, type: "downgrade" })
                  )}
                </CardContent>
              </Card>
            </BlurFade>
          )}

          {allOptions.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Bu hizmet için uygun paket değişikliği seçeneği bulunamadı.
              </CardContent>
            </Card>
          )}

          {selectedOption && !isDowngrade && (
            <BlurFade delay={0.25} inView>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Ödeme Yöntemi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        onClick={() => setSelectedPayment(method.id)}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                          selectedPayment === method.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <method.icon
                          className={cn(
                            "h-5 w-5",
                            selectedPayment === method.id
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                        />
                        <span className="font-medium">{method.name}</span>
                        {selectedPayment === method.id && (
                          <CheckCircle2 className="h-5 w-5 text-primary ml-auto" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </BlurFade>
          )}
        </div>

        <div className="lg:col-span-1">
          <BlurFade delay={0.3} inView>
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Özet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Mevcut Paket</p>
                  <p className="font-medium">{service.product.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {currencyFormatter.format(service.amount)} /{" "}
                    {billingPeriodLabels[service.billingPeriod] || service.billingPeriod}
                  </p>
                </div>

                {selectedOption ? (
                  <>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Yeni Paket</p>
                      <p className="font-medium">{selectedOption.name}</p>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Kalan gün</span>
                      <span>{selectedOption.remainingDays} gün</span>
                    </div>

                    {!isDowngrade && (
                      <div className="flex items-center justify-between font-semibold text-lg pt-2 border-t">
                        <span>Ödenecek</span>
                        <span className="text-primary">
                          {currencyFormatter.format(chargeAmount)}
                        </span>
                      </div>
                    )}

                    {isDowngrade && (
                      <p className="text-sm text-orange-600 dark:text-orange-400">
                        Düşürme talebi yönetici onayından sonra uygulanır.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Devam etmek için bir paket seçin.
                  </p>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => void handleSubmit()}
                  disabled={!selectedSku || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      İşleniyor...
                    </>
                  ) : isDowngrade ? (
                    "Düşürme Talebi Gönder"
                  ) : (
                    "Yükseltmeyi Tamamla"
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  <Shield className="inline h-3 w-3 mr-1" />
                  Güvenli işlem
                </p>
              </CardContent>
            </Card>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}