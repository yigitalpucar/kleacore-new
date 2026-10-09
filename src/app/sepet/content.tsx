"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonClasses } from "@/components/site/button-classes";
import { CornerTicks } from "@/components/site/grid-lines";
import { Section } from "@/components/site/section";
import { CheckoutHeader } from "@/components/site/hosting/checkout-header";
import { formatTRY } from "@/lib/format/price";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";
import { checkoutCart } from "@/lib/actions/customer/checkout";
import {
  ArrowRight,
  Globe,
  Loader2,
  Lock,
  Package,
  Server,
  ShoppingCart,
  Trash2,
  WalletCards,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { handleCreditCardCheckoutRedirect } from "@/lib/payments/checkout-redirect";
import { addonPeriodTotal, priceBasisForItemType } from "@/lib/billing/period-price";
import { PeriodBadge, PeriodNote } from "@/components/checkout/period-note";
import type { CartItem } from "@/store/cart-store";
import { cartTotals } from "@/lib/billing/cart-totals";
import { validateCartItems } from "@/lib/checkout/validate-cart";
import { PaymentMethodPicker } from "@/components/checkout/payment-method-picker";
import type { CustomerPaymentOptions } from "@/lib/payments/payment-options";
import { isPaymentMethodId, paymentRecordMethod } from "@/lib/integrations/payment-gateways/methods-config";
import { CheckoutLegalConsent, type CheckoutLegalDocument } from "@/components/checkout/legal-consent";
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import type { LegalBuyer, LegalSeller } from "@/lib/legal/render";

function formatPrice(value: number) {
  return formatTRY(value, { keepDecimals: true });
}

const typeLabels: Record<CartItem["type"], string> = {
  domain: "Alan adı",
  hosting: "Hosting",
  server: "Sunucu",
  ssl: "SSL sertifikası",
  datacenter: "Veri merkezi",
};

function itemPeriod(item: CartItem): "monthly" | "yearly" {
  // Domain registrations are always one year.
  if (item.type === "domain") return "yearly";
  return item.metadata?.billingPeriod === "yearly" ? "yearly" : "monthly";
}

export function SepetContent({
  taxRate,
  paymentOptions,
  emailVerified,
  userEmail,
  legal,
}: {
  taxRate: number;
  paymentOptions: CustomerPaymentOptions;
  emailVerified: boolean;
  userEmail: string | null;
  legal: { documents: CheckoutLegalDocument[]; seller: LegalSeller; buyer: LegalBuyer | null };
}) {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const removeItem = useCartStore((state) => state.removeItem);
  const setItemDomain = useCartStore((state) => state.setItemDomain);
  const clearCart = useCartStore((state) => state.clearCart);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const totalItems = useCartStore((state) => state.getTotalItems());
  // KDV per line, as checkout charges it (one invoice per cart line).
  const { taxAmount, total: grandTotal } = cartTotals(items, taxRate);
  const hasYearly = items.some(
    (item) => itemPeriod(item) === "yearly" && priceBasisForItemType(item.type) === "monthly-equivalent"
  );
  const [paymentMethod, setPaymentMethod] = useState<string | null>(paymentOptions.defaultMethod);
  const selectedKind = [...paymentOptions.options, ...paymentOptions.otherCards].find(
    (option) => option.id === paymentMethod
  )?.kind;
  const [promoCode, setPromoCode] = useState("");
  const [isPending, startTransition] = useTransition();
  // Same rules as checkoutCart (minus the TLD list): a cart that can't be
  // provisioned is fixed here, before payment.
  const cartErrors = validateCartItems(items);
  const errorsByItem = new Map(cartErrors.map((error) => [error.itemId, error.message]));
  const [acceptedDocuments, setAcceptedDocuments] = useState<Record<string, boolean>>({});
  const allDocumentsAccepted = legal.documents.every((document) => acceptedDocuments[document.id]);

  const handleRemove = (id: string, title: string) => {
    removeItem(id);
    toast.info(`${title} sepetten kaldırıldı.`);
  };

  const handleClear = () => {
    clearCart();
    toast.info("Sepet temizlendi.");
  };

  const handleCheckout = () => {
    if (cartErrors.length > 0) {
      toast.error(cartErrors[0].message);
      return;
    }
    if (!paymentMethod) {
      toast.error("Lütfen bir ödeme yöntemi seçin.");
      return;
    }
    if (!allDocumentsAccepted) {
      toast.error("Devam etmek için Ön Bilgilendirme Formu'nu ve Mesafeli Satış Sözleşmesi'ni onaylayın.");
      return;
    }
    startTransition(async () => {
      const result = await checkoutCart({
        paymentMethod,
        promoCode,
        consents: legal.documents.map((document) => ({
          documentId: document.id,
          version: document.version,
        })),
        items: items.map((item) => ({
          id: item.id,
          type: item.type,
          quantity: item.quantity,
          metadata: item.metadata,
        })),
      });

      if (!result.success) {
        if (result.code === "LOGIN_REQUIRED") {
          toast.info("Ödeme için giriş yapmalısınız.");
          router.push("/musteri/giris?callbackUrl=%2Fsepet");
          return;
        }
        if (result.code === "LEGAL_CONSENT_OUTDATED") {
          toast.error(result.error);
          router.refresh();
          setAcceptedDocuments({});
          return;
        }

        toast.error(result.error ?? "Sipariş oluşturulurken bir hata oluştu.");
        return;
      }

      clearCart();
      if (result.data && "paymentBlocked" in result.data && result.data.paymentBlocked) {
        toast.info("Siparişiniz güvenlik incelemesinde, onaylandığında ödeme yapabilirsiniz. Sonucu e-posta ile bildireceğiz.");
        router.push("/musteri/panel");
        return;
      }
      if (
        result.data &&
        handleCreditCardCheckoutRedirect(
          {
            checkoutUrl: "checkoutUrl" in result.data ? result.data.checkoutUrl : null,
            checkoutHtml: "checkoutHtml" in result.data ? result.data.checkoutHtml : null,
            paytrToken: "paytrToken" in result.data ? result.data.paytrToken : null,
          },
          router
        )
      ) {
        return;
      }

      const invoiceIds = result.data && "invoiceIds" in result.data ? result.data.invoiceIds : [];
      const paidWithBalance = Boolean(result.data && "paidWithBalance" in result.data && result.data.paidWithBalance);

      if (selectedKind === "balance") {
        if (paidWithBalance && result.data && "kycRequired" in result.data && result.data.kycRequired) {
          toast.info("Ödemeniz alındı. Sunucunuzun kurulumu için kimlik doğrulaması gerekli.");
          router.push("/musteri/panel/kimlik-dogrulama");
          return;
        }
        if (paidWithBalance) {
          toast.success("Siparişiniz bakiyenizden ödendi.");
        } else {
          toast.error("Bakiye ile ödenemedi; faturalarınızı başka bir yöntemle ödeyebilirsiniz.");
        }
        router.push("/musteri/panel/faturalar");
        return;
      }

      if (selectedKind === "bank_transfer") {
        toast.success("Siparişiniz oluşturuldu. Havale/EFT bilgileri ve ödeme bildirimi faturanızda.");
        router.push(
          invoiceIds.length === 1
            ? `/musteri/panel/faturalar/${invoiceIds[0]}?odeme=havale`
            : "/musteri/panel/faturalar"
        );
        return;
      }

      toast.success("Ödeme sayfasına yönlendiriliyorsunuz.");
      router.push("/musteri/panel/faturalar");
    });
  };

  return (
    <>
      <CheckoutHeader
        breadcrumbs={[{ label: "Sepet" }]}
        eyebrow="Sipariş"
        title="Sepetiniz"
        description={
          hasHydrated
            ? items.length > 0
              ? `Sepetinizde ${totalItems} ürün var. Ödeme yöntemini seçip siparişinizi tamamlayın.`
              : "Sepetinizde henüz ürün yok."
            : "Sepet yükleniyor…"
        }
      />

      <Section spacing="sm">
        {!hasHydrated ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]" aria-hidden>
            <div className="h-48 animate-pulse rounded-2xl border bg-muted/40" />
            <div className="h-72 animate-pulse rounded-2xl border bg-muted/40" />
          </div>
        ) : items.length === 0 ? (
          <div className="relative mx-auto max-w-2xl overflow-hidden rounded-2xl border bg-background px-6 py-14 text-center">
            <CornerTicks />
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl border bg-muted/40">
              <ShoppingCart aria-hidden className="size-5 text-foreground/80" />
            </span>
            <h2 className="mt-5 text-xl font-semibold tracking-tight">Sepetiniz boş</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Bir alan adı sorgulayarak veya hosting paketi seçerek başlayabilirsiniz.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/domain/kayit" className={buttonClasses()}>
                Alan adı sorgula
                <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link href="/hosting/linux" className={buttonClasses({ variant: "outline" })}>
                Hosting paketleri
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
            <section aria-labelledby="sepet-urunleri" className="min-w-0">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id="sepet-urunleri" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Sepetteki ürünler
                </h2>
                <button
                  type="button"
                  onClick={handleClear}
                  className={buttonClasses({ variant: "ghost", size: "sm", className: "min-h-11 text-muted-foreground" })}
                >
                  Sepeti temizle
                </button>
              </div>
              <ul className="divide-y divide-dashed overflow-hidden rounded-2xl border bg-background">
                {items.map((item) => {
                  const period = itemPeriod(item);
                  const basis = priceBasisForItemType(item.type);
                  const lineTotal = item.unitPrice * item.quantity;
                  return (
                    <li key={item.id} className="flex gap-4 p-4 sm:p-5">
                      <span className="hidden size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 sm:flex">
                        {item.type === "domain" ? (
                          <Globe aria-hidden className="size-4 text-foreground/80" />
                        ) : (
                          <Server aria-hidden className="size-4 text-foreground/80" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                              {typeLabels[item.type]}
                            </p>
                            <h3 className="mt-0.5 break-words font-medium">{item.title}</h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemove(item.id, item.title)}
                            aria-label={`${item.title} ürününü sepetten kaldır`}
                            className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Trash2 aria-hidden className="size-4" />
                          </button>
                        </div>

                        {item.type === "hosting" && item.metadata?.domainChoice?.domain ? (
                          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Globe aria-hidden className="size-3.5 shrink-0" />
                            <span className="min-w-0 break-all">
                              {item.metadata.domainChoice.type === "new" ? "Yeni alan adı" : "Mevcut alan adı"}:{" "}
                              {item.metadata.domainChoice.domain}
                            </span>
                          </p>
                        ) : null}

                        {item.type === "ssl" ? (
                          <div className="mt-3">
                            <label htmlFor={`ssl-domain-${item.id}`} className="text-sm font-medium">
                              Sertifika alan adı
                            </label>
                            <input
                              id={`ssl-domain-${item.id}`}
                              className="mt-1.5 h-11 w-full rounded-lg border bg-background px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              placeholder="ornek.com.tr"
                              autoComplete="off"
                              inputMode="url"
                              value={item.metadata?.domain ?? ""}
                              onChange={(event) => setItemDomain(item.id, event.target.value)}
                              aria-invalid={errorsByItem.has(item.id)}
                              aria-describedby={errorsByItem.has(item.id) ? `cart-error-${item.id}` : undefined}
                            />
                          </div>
                        ) : null}

                        {errorsByItem.has(item.id) ? (
                          <p id={`cart-error-${item.id}`} role="alert" className="mt-2 text-sm text-destructive">
                            {errorsByItem.get(item.id)}
                          </p>
                        ) : null}

                        {item.type === "hosting" && item.metadata?.addons && item.metadata.addons.length > 0 ? (
                          <ul className="mt-3 space-y-1 text-sm" aria-label="Paket ve ek hizmetler">
                            <li className="flex items-center justify-between gap-3 text-muted-foreground">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <Server aria-hidden className="size-3.5 shrink-0" />
                                <span className="truncate">Paket ve seçenekler</span>
                              </span>
                              <span className="shrink-0 tabular-nums">
                                {formatPrice(
                                  item.unitPrice -
                                    item.metadata.addons.reduce(
                                      (sum, addon) => sum + addonPeriodTotal(addon, period),
                                      0
                                    )
                                )}
                              </span>
                            </li>
                            {item.metadata.addons.map((addon) => (
                              <li key={addon.sku} className="flex items-center justify-between gap-3 text-muted-foreground">
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <Package aria-hidden className="size-3.5 shrink-0" />
                                  <span className="truncate">{addon.name}</span>
                                </span>
                                <span className="shrink-0 tabular-nums">
                                  {formatPrice(addonPeriodTotal(addon, period))}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                          <div className="space-y-1">
                            <PeriodBadge period={period} />
                            {item.type === "domain" && item.metadata?.renewPrice ? (
                              <p className="text-xs text-muted-foreground">
                                Yenileme: {formatPrice(item.metadata.renewPrice)}/yıl +KDV
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <p className="font-semibold tabular-nums">{formatPrice(lineTotal)}</p>
                            <PeriodNote total={lineTotal} period={period} basis={basis} />
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <aside aria-labelledby="sepet-ozet" className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl bg-muted/60 p-1.5 ring-1 ring-border dark:bg-muted/30">
                <div className="rounded-xl bg-background p-5 shadow-[0_6px_10px_-6px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
                  <h2 id="sepet-ozet" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Sipariş özeti
                  </h2>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Ürün sayısı</dt>
                      <dd className="tabular-nums">{totalItems}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">Ara toplam (KDV hariç)</dt>
                      <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted-foreground">KDV (%{taxRate})</dt>
                      <dd className="tabular-nums">{formatPrice(taxAmount)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4 border-t border-dashed pt-3">
                      <dt className="font-medium">
                        Toplam
                        <span className="block text-xs font-normal text-muted-foreground">KDV dahil</span>
                      </dt>
                      <dd className="text-2xl font-semibold tabular-nums tracking-tight">
                        {formatPrice(grandTotal)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {hasYearly
                      ? "Yıllık ödemeli ürünlerde 12 aylık tutar tek seferde faturalanır. "
                      : null}
                    Kupon ve bayi indirimleri ödeme adımında doğrulanıp düşülür.
                  </p>
                </div>

                <div className="space-y-5 p-5">
                  <div>
                    <label className="text-sm font-medium" htmlFor="promo-code">
                      Promosyon kodu
                    </label>
                    <input
                      id="promo-code"
                      value={promoCode}
                      onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                      placeholder="Kupon kodu"
                      autoComplete="off"
                      className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm uppercase shadow-sm placeholder:normal-case placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">Kupon ödeme sırasında doğrulanır.</p>
                  </div>

                  <PaymentMethodPicker
                    options={paymentOptions.options}
                    otherCards={paymentOptions.otherCards}
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    payableAmount={grandTotal}
                    balance={paymentOptions.balance}
                    name="payment-method"
                  />

                  <CheckoutLegalConsent
                    documents={legal.documents}
                    seller={legal.seller}
                    buyer={legal.buyer}
                    items={items}
                    taxRate={taxRate}
                    paymentMethod={
                      paymentMethod && isPaymentMethodId(paymentMethod) ? paymentRecordMethod(paymentMethod) : ""
                    }
                    accepted={acceptedDocuments}
                    onAcceptedChange={(documentId, value) =>
                      setAcceptedDocuments((current) => ({ ...current, [documentId]: value }))
                    }
                    disabled={isPending}
                  />

                  {emailVerified ? null : <EmailVerificationBanner email={userEmail} compact />}

                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={
                      isPending || cartErrors.length > 0 || !paymentMethod || !emailVerified || !allDocumentsAccepted
                    }
                    className={buttonClasses({ size: "lg", className: "w-full disabled:opacity-60" })}
                  >
                    {isPending ? (
                      <>
                        <Loader2 aria-hidden className="size-4 animate-spin" />
                        Sipariş oluşturuluyor…
                      </>
                    ) : (
                      <>
                        <WalletCards aria-hidden className="size-4" />
                        Ödemeye geç
                        <ArrowRight aria-hidden className="size-4" />
                      </>
                    )}
                  </button>
                  <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Lock aria-hidden className="size-3" />
                    Ödeme için müşteri hesabınızla giriş yapmanız gerekir.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </Section>
    </>
  );
}
