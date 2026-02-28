"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  RefreshCcw,
  Calendar,
  CreditCard,
  CheckCircle2,
  Gift,
  Shield,
  Percent,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { renewService } from "@/lib/actions/customer/services";
import { toast } from "@/lib/toast";

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
    category: {
      slug: string;
      name: string;
    } | null;
  };
}

interface ServiceRenewalContentProps {
  service: ServiceData;
  userBalance: number;
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

const renewalOptions = [
  { period: "1 Ay", months: 1, discount: 0, popular: false },
  { period: "3 Ay", months: 3, discount: 5, popular: false },
  { period: "6 Ay", months: 6, discount: 10, popular: false },
  { period: "1 Yıl", months: 12, discount: 15, popular: true },
  { period: "2 Yıl", months: 24, discount: 20, popular: false },
  { period: "3 Yıl", months: 36, discount: 25, popular: false },
];

export function ServiceRenewalContent({ service, userBalance }: ServiceRenewalContentProps) {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState(12);
  const [selectedPayment, setSelectedPayment] = useState("credit-card");
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedOption = renewalOptions.find((opt) => opt.months === selectedPeriod)!;

  // Calculate monthly price from the service amount and billing period
  const periodMonths: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    semiannual: 6,
    yearly: 12,
    biennial: 24,
    triennial: 36,
  };
  const currentPeriodMonths = periodMonths[service.billingPeriod] || 1;
  const monthlyPrice = service.amount / currentPeriodMonths;

  const totalPrice = monthlyPrice * selectedPeriod;
  const discountAmount = (totalPrice * selectedOption.discount) / 100;
  const finalPrice = totalPrice - discountAmount;

  const paymentMethods = [
    { id: "credit-card", name: "Kredi Kartı", icon: CreditCard },
    { id: "balance", name: `Bakiye (${currencyFormatter.format(userBalance)})`, icon: Package },
  ];

  const handleRenewal = async () => {
    setIsProcessing(true);

    if (selectedPayment === "balance" && userBalance < finalPrice) {
      toast.error("Yetersiz bakiye. Lütfen kredi yükleyin.");
      setIsProcessing(false);
      return;
    }

    const result = await renewService({
      serviceId: service.id,
      months: selectedPeriod as 1 | 3 | 6 | 12 | 24 | 36,
      paymentMethod: selectedPayment === "balance" ? "BALANCE" : "CREDIT_CARD",
    });

    if (!result.success) {
      toast.error(result.error ?? "Hizmet yenilenemedi");
      setIsProcessing(false);
      return;
    }

    toast.success(result.message ?? "Hizmet başarıyla yenilendi");
    router.push(`/musteri/panel/hizmetlerim/${service.id}`);
    router.refresh();
  };

  const calculateNewExpiry = () => {
    const base = service.nextDueDate || service.expiresAt;
    const startDate = base ? new Date(base) : new Date();
    startDate.setMonth(startDate.getMonth() + selectedPeriod);
    return startDate.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const currentExpiryDisplay = () => {
    const date = service.nextDueDate || service.expiresAt;
    if (!date) return "-";
    return new Date(date).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0.1} inView>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/musteri/panel/hizmetlerim/${service.id}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hizmeti Yenile</h1>
            <p className="text-muted-foreground">
              {service.product.name} - {service.domain || service.label || "-"}
            </p>
          </div>
        </div>
      </BlurFade>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Renewal Options */}
        <div className="lg:col-span-2 space-y-6">
          <BlurFade delay={0.15} inView>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Yenileme Süresi Seçin
                </CardTitle>
                <CardDescription>
                  Daha uzun süre seçerek daha fazla tasarruf edin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {renewalOptions.map((option) => {
                    const optionPrice = monthlyPrice * option.months;
                    const optionDiscount = (optionPrice * option.discount) / 100;
                    const optionFinal = optionPrice - optionDiscount;

                    return (
                      <div
                        key={option.months}
                        onClick={() => setSelectedPeriod(option.months)}
                        className={cn(
                          "relative p-4 rounded-lg border-2 cursor-pointer transition-all",
                          selectedPeriod === option.months
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {option.popular && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                              Popüler
                            </span>
                          </div>
                        )}
                        {option.discount > 0 && (
                          <div className="absolute -top-2.5 right-2">
                            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                              %{option.discount} İndirim
                            </span>
                          </div>
                        )}
                        <div className="text-center pt-2">
                          <p className="font-semibold text-lg">{option.period}</p>
                          <p className="text-2xl font-bold text-primary mt-1">
                            {currencyFormatter.format(optionFinal)}
                          </p>
                          {option.discount > 0 && (
                            <p className="text-sm text-muted-foreground line-through">
                              {currencyFormatter.format(optionPrice)}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {currencyFormatter.format(optionFinal / option.months)}/ay
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </BlurFade>

          {/* Payment Method */}
          <BlurFade delay={0.2} inView>
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
                      <method.icon className={cn(
                        "h-5 w-5",
                        selectedPayment === method.id ? "text-primary" : "text-muted-foreground"
                      )} />
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

          {/* Benefits */}
          <BlurFade delay={0.25} inView>
            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Gift className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">
                      Yenileme Avantajları
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Hizmet kesintisi olmadan süre uzatma
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Mevcut ayarlarınız korunur
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Anında aktivasyon
                      </li>
                      {selectedOption.discount > 0 && (
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          %{selectedOption.discount} indirim avantajı
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <BlurFade delay={0.3} inView>
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Sipariş Özeti</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Service Info */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium">{service.product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {service.domain || service.label || "-"}
                  </p>
                </div>

                {/* Current Expiry */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mevcut Bitiş:</span>
                  <span>{currentExpiryDisplay()}</span>
                </div>

                {/* New Expiry */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Yeni Bitiş:</span>
                  <span className="text-green-600 font-medium">{calculateNewExpiry()}</span>
                </div>

                {/* Period */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Yenileme Süresi:</span>
                  <span>{selectedOption.period}</span>
                </div>

                <div className="border-t pt-4 space-y-2">
                  {/* Subtotal */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Ara Toplam:</span>
                    <span>{currencyFormatter.format(totalPrice)}</span>
                  </div>

                  {/* Discount */}
                  {selectedOption.discount > 0 && (
                    <div className="flex items-center justify-between text-sm text-green-600">
                      <span className="flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        İndirim (%{selectedOption.discount}):
                      </span>
                      <span>-{currencyFormatter.format(discountAmount)}</span>
                    </div>
                  )}

                  {/* Total */}
                  <div className="flex items-center justify-between font-semibold text-lg pt-2 border-t">
                    <span>Toplam:</span>
                    <span className="text-primary">{currencyFormatter.format(finalPrice)}</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleRenewal}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                      İşleniyor...
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Yenilemeyi Tamamla
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  <Shield className="inline h-3 w-3 mr-1" />
                  256-bit SSL ile güvenli ödeme
                </p>
              </CardContent>
            </Card>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
