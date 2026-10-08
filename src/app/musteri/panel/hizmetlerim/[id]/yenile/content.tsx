"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, CreditCard, Loader2, RefreshCcw } from "lucide-react";
import { AppBreadcrumbLabel, DetailList, PageHeader, SectionCard, appButton } from "@/components/app";
import type { CustomerPaymentMethod } from "@/lib/payments/methods";
import { cn } from "@/lib/utils";
import { renewService } from "@/lib/actions/customer/services";
import { handleCreditCardCheckoutRedirect } from "@/lib/payments/checkout-redirect";
import { toast } from "@/lib/toast";
import { formatTRY } from "@/lib/format/price";
import { formatDateLong } from "@/lib/format/date";

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
}

const money = (n: number) => formatTRY(n, { keepDecimals: true });

// Must match renewalDiscountByMonths in src/lib/actions/customer/services.ts
const renewalOptions = [
  { period: "1 ay", months: 1, discount: 0 },
  { period: "3 ay", months: 3, discount: 5 },
  { period: "6 ay", months: 6, discount: 10 },
  { period: "1 yıl", months: 12, discount: 15 },
  { period: "2 yıl", months: 24, discount: 20 },
  { period: "3 yıl", months: 36, discount: 25 },
];

const paymentMethods = [
  { id: "credit-card", name: "Kredi kartı", description: "Güvenli ödeme sayfasında anında ödeme", icon: CreditCard },
  { id: "bank-transfer", name: "Banka havalesi", description: "Havale/EFT sonrası manuel onay", icon: Building2 },
];

const periodMonths: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
  biennial: 24,
  triennial: 36,
};

export function ServiceRenewalContent({ service }: ServiceRenewalContentProps) {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState(12);
  const [selectedPayment, setSelectedPayment] = useState("credit-card");
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedOption = renewalOptions.find((opt) => opt.months === selectedPeriod)!;

  const currentPeriodMonths = periodMonths[service.billingPeriod] || 1;
  const monthlyPrice = service.amount / currentPeriodMonths;

  const totalPrice = monthlyPrice * selectedPeriod;
  const discountAmount = (totalPrice * selectedOption.discount) / 100;
  const finalPrice = totalPrice - discountAmount;

  const handleRenewal = async () => {
    setIsProcessing(true);

    const paymentMethod: CustomerPaymentMethod =
      selectedPayment === "bank-transfer" ? "BANK_TRANSFER" : "CREDIT_CARD";

    const result = await renewService({
      serviceId: service.id,
      months: selectedPeriod as 1 | 3 | 6 | 12 | 24 | 36,
      paymentMethod,
    });

    if (!result.success) {
      toast.error(result.error ?? "Hizmet yenilenemedi");
      setIsProcessing(false);
      return;
    }

    if (
      result.data &&
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

    toast.success(result.message ?? "Yenileme talebiniz alındı");
    router.push(`/musteri/panel/hizmetlerim/${service.id}`);
    router.refresh();
  };

  const currentExpiry = service.nextDueDate || service.expiresAt;

  // Same base the server uses: the later of today and the current expiry.
  const calculateNewExpiry = () => {
    const now = new Date();
    const current = currentExpiry ? new Date(currentExpiry) : now;
    const base = current.getTime() > now.getTime() ? current : now;
    const next = new Date(base);
    next.setMonth(next.getMonth() + selectedPeriod);
    return formatDateLong(next);
  };

  const subtitle = `${service.product.name} · ${service.domain || service.label || "—"}`;

  return (
    <>
      <AppBreadcrumbLabel segment={service.id} label={service.product.name} />

      <PageHeader
        back={{ href: `/musteri/panel/hizmetlerim/${service.id}`, label: service.product.name }}
        title="Hizmeti yenile"
        description={subtitle}
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SectionCard title="Yenileme süresi" description="Uzun dönemlerde yenileme indirimi uygulanır.">
            <div role="radiogroup" aria-label="Yenileme süresi" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {renewalOptions.map((option) => {
                const optionPrice = monthlyPrice * option.months;
                const optionFinal = optionPrice - (optionPrice * option.discount) / 100;
                const selected = selectedPeriod === option.months;
                return (
                  <button
                    key={option.months}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedPeriod(option.months)}
                    className={cn(
                      "relative rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-4",
                      selected ? "border-foreground bg-muted/50 ring-1 ring-foreground" : "hover:bg-muted/40"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{option.period}</span>
                      {option.discount > 0 ? (
                        <span className="rounded border px-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                          %{option.discount}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-2 block text-lg font-semibold tabular-nums tracking-tight">{money(optionFinal)}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {money(optionFinal / option.months)} / ay
                    </span>
                    {selected ? (
                      <Check aria-hidden className="absolute bottom-3 right-3 size-4" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </SectionCard>

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
                      "flex min-h-[56px] items-center gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected ? "border-foreground bg-muted/50 ring-1 ring-foreground" : "hover:bg-muted/40"
                    )}
                  >
                    <method.icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{method.name}</span>
                      <span className="block text-xs text-muted-foreground">{method.description}</span>
                    </span>
                    {selected ? <Check aria-hidden className="size-4 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <div className="rounded-lg border border-dashed p-4 text-sm">
            <p className="font-medium">Yenileme hakkında</p>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              <li className="flex gap-2">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
                Süre, mevcut bitiş tarihinin üzerine eklenir; hizmetiniz kesintiye uğramaz.
              </li>
              <li className="flex gap-2">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
                Mevcut ayarlarınız ve verileriniz korunur.
              </li>
              <li className="flex gap-2">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
                Havale ile ödemede yenileme, ödemeniz onaylandıktan sonra işlenir.
              </li>
            </ul>
          </div>
        </div>

        <SectionCard title="Özet" className="lg:sticky lg:top-20">
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm font-medium">{service.product.name}</p>
            <p className="truncate text-xs text-muted-foreground">{service.domain || service.label || "—"}</p>
          </div>
          <DetailList
            className="mt-4"
            items={[
              { label: "Mevcut bitiş", value: formatDateLong(currentExpiry) },
              { label: "Yeni bitiş", value: calculateNewExpiry() },
              { label: "Yenileme süresi", value: selectedOption.period },
            ]}
          />
          <dl className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Ara toplam</dt>
              <dd className="tabular-nums">{money(totalPrice)}</dd>
            </div>
            {selectedOption.discount > 0 ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Yenileme indirimi (%{selectedOption.discount})</dt>
                <dd className="tabular-nums">−{money(discountAmount)}</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-3 border-t border-dashed pt-2">
              <dt className="font-medium">Toplam</dt>
              <dd className="text-xl font-semibold tabular-nums tracking-tight">{money(finalPrice)}</dd>
            </div>
          </dl>
          <p className="mt-1 text-right text-xs text-muted-foreground">KDV hariçtir; ödeme adımında eklenir.</p>

          <button
            type="button"
            onClick={handleRenewal}
            disabled={isProcessing}
            className={appButton({ className: "mt-4 w-full md:h-10" })}
          >
            {isProcessing ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCcw aria-hidden />}
            {isProcessing ? "İşleniyor…" : "Yenilemeyi tamamla"}
          </button>
        </SectionCard>
      </div>
    </>
  );
}
