"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { buttonClasses } from "@/components/site/button-classes";
import { CornerTicks } from "@/components/site/grid-lines";
import { Section } from "@/components/site/section";
import { CheckoutHeader } from "@/components/site/hosting/checkout-header";
import { formatTRY } from "@/lib/format/price";
import { useCartStore } from "@/store/cart-store";
import { checkoutCart } from "@/lib/actions/customer/checkout";
import {
  ArrowRight,
  Globe,
  Loader2,
  Lock,
  LogIn,
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
import { validateCartItems } from "@/lib/checkout/validate-cart";
import { PaymentMethodPicker } from "@/components/checkout/payment-method-picker";
import type { CustomerPaymentOptions } from "@/lib/payments/payment-options";
import {
  PAYMENT_METHOD_LABELS,
  isCardGatewayId,
  isPaymentMethodId,
  paymentRecordMethod,
} from "@/lib/integrations/payment-gateways/methods-config";
import { CheckoutLegalConsent, type CheckoutLegalDocument } from "@/components/checkout/legal-consent";
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import type { LegalBuyer, LegalSeller } from "@/lib/legal/render";
import { CheckoutSteps } from "@/components/checkout/checkout-steps";
import { BuyerInfoCard } from "@/components/checkout/buyer-info-card";
import { CouponField } from "@/components/checkout/coupon-field";
import { OrderSummaryLines } from "@/components/checkout/order-summary";
import { MobileSummaryBar } from "@/components/checkout/mobile-summary-bar";
import { PeriodSwitch } from "@/components/checkout/period-switch";
import { useCartQuote } from "@/components/checkout/use-cart-quote";
import {
  PaymentRedirectOverlay,
  useResetOnPageShow,
  type PaymentRedirectPhase,
} from "@/components/checkout/payment-redirect-overlay";

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

const LOGIN_HREF = "/musteri/giris?callbackUrl=%2Fsepet";

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
  signedIn,
  legal,
}: {
  taxRate: number;
  paymentOptions: CustomerPaymentOptions;
  emailVerified: boolean;
  userEmail: string | null;
  signedIn: boolean;
  legal: { documents: CheckoutLegalDocument[]; seller: LegalSeller; buyer: LegalBuyer | null };
}) {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const removeItem = useCartStore((state) => state.removeItem);
  const setItemDomain = useCartStore((state) => state.setItemDomain);
  const setItemPeriod = useCartStore((state) => state.setItemPeriod);
  const clearCart = useCartStore((state) => state.clearCart);
  const totalItems = useCartStore((state) => state.getTotalItems());
  const hasYearly = items.some(
    (item) => itemPeriod(item) === "yearly" && priceBasisForItemType(item.type) === "monthly-equivalent"
  );
  const [paymentMethod, setPaymentMethod] = useState<string | null>(paymentOptions.defaultMethod);
  const selectedKind = [...paymentOptions.options, ...paymentOptions.otherCards].find(
    (option) => option.id === paymentMethod
  )?.kind;

  // Coupon: `promoInput` is what is typed, `promoCode` what was submitted
  // for the server quote to check.
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const { quote, lastQuote, summary, pending: quotePending, error: quoteError } = useCartQuote(
    items,
    promoCode,
    taxRate,
    hasHydrated
  );
  const promoResult = quote?.promo ?? null;
  const appliedPromo =
    lastQuote?.promo && lastQuote.promo.ok && lastQuote.promo.code === promoCode && promoCode
      ? { code: lastQuote.promo.code, discount: lastQuote.promo.discount }
      : null;
  const promoError = promoResult && !promoResult.ok && promoResult.code === promoCode ? promoResult.error : null;

  const [isPending, startTransition] = useTransition();
  const [redirectPhase, setRedirectPhase] = useState<PaymentRedirectPhase | null>(null);
  const submittingRef = useRef(false);
  useResetOnPageShow(() => {
    submittingRef.current = false;
    setRedirectPhase(null);
  });

  // Same rules as checkoutCart (minus the TLD list): a cart that can't be
  // provisioned is fixed here, before payment. Lines the server could not
  // price (product no longer sold…) are blocking too.
  const cartErrors = validateCartItems(items);
  const errorsByItem = new Map(cartErrors.map((error) => [error.itemId, error.message]));
  const quoteLines = new Map((lastQuote?.lines ?? []).map((line) => [line.id, line]));
  for (const line of quote?.lines ?? []) {
    if (!line.ok && !errorsByItem.has(line.id)) errorsByItem.set(line.id, line.error);
  }
  const [acceptedDocuments, setAcceptedDocuments] = useState<Record<string, boolean>>({});
  const allDocumentsAccepted = legal.documents.every((document) => acceptedDocuments[document.id]);

  const selectedGateway =
    paymentMethod && isCardGatewayId(paymentMethod) ? PAYMENT_METHOD_LABELS[paymentMethod] : null;

  // First thing still missing before the order can be placed (null = ready).
  const blocker: { message: string; target: string } | null = !signedIn
    ? { message: "Ödeme için giriş yapın.", target: "sepet-bilgiler" }
    : errorsByItem.size > 0
      ? { message: [...errorsByItem.values()][0], target: "sepet-urunleri" }
      : !paymentMethod
        ? { message: "Bir ödeme yöntemi seçin.", target: "sepet-odeme" }
        : selectedKind === "balance" &&
            typeof paymentOptions.balance === "number" &&
            paymentOptions.balance < summary.total
          ? { message: "Bakiyeniz bu sipariş için yetersiz; başka bir ödeme yöntemi seçin.", target: "sepet-odeme" }
        : !emailVerified
          ? { message: "E-posta adresinizi doğrulayın.", target: "sepet-odeme" }
          : !allDocumentsAccepted
            ? { message: "Sözleşmeleri okuyup onaylayın.", target: "sepet-sozlesmeler" }
            : quotePending
              ? { message: "Tutar güncelleniyor…", target: "sepet-ozet" }
              : null;

  // Hide the phone sticky bar while the summary's own button is on screen.
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(false);
  useEffect(() => {
    const node = ctaRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting), {
      rootMargin: "0px 0px -40px 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasHydrated, items.length]);

  const handleRemove = (id: string, title: string) => {
    removeItem(id);
    toast.info(`${title} sepetten kaldırıldı.`);
  };

  const handleClear = () => {
    clearCart();
    toast.info("Sepet temizlendi.");
  };

  const handlePeriodChange = (item: CartItem, period: "monthly" | "yearly", unitPrice: number) => {
    if (itemPeriod(item) === period) return;
    if (!setItemPeriod(item.id, period, unitPrice)) {
      toast.error("Bu ürün seçtiğiniz dönemle zaten sepetinizde.");
    }
  };

  const focusBlocker = (target: string) => {
    const node = document.getElementById(target);
    if (!node) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  };

  const handleCheckout = () => {
    if (submittingRef.current) return;
    if (!signedIn) {
      router.push(LOGIN_HREF);
      return;
    }
    if (blocker) {
      toast.error(blocker.message);
      focusBlocker(blocker.target);
      return;
    }
    if (!paymentMethod) return;

    submittingRef.current = true;
    setRedirectPhase("creating");
    const release = () => {
      submittingRef.current = false;
      setRedirectPhase(null);
    };

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof checkoutCart>>;
      try {
        result = await checkoutCart({
          paymentMethod,
          // Only a code the quote accepted; a rejected one would fail the order.
          promoCode: appliedPromo ? appliedPromo.code : "",
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
      } catch {
        release();
        toast.error("Bağlantı hatası: sipariş oluşturulamadı. Lütfen tekrar deneyin.");
        return;
      }

      if (!result.success) {
        release();
        if (result.code === "LOGIN_REQUIRED") {
          toast.info("Ödeme için giriş yapmalısınız.");
          router.push(LOGIN_HREF);
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
      const redirect = {
        checkoutUrl: result.data && "checkoutUrl" in result.data ? result.data.checkoutUrl : null,
        checkoutHtml: result.data && "checkoutHtml" in result.data ? result.data.checkoutHtml : null,
        paytrToken: result.data && "paytrToken" in result.data ? result.data.paytrToken : null,
      };
      if (redirect.checkoutUrl || redirect.checkoutHtml || redirect.paytrToken) {
        // The overlay stays up until the browser has left for the payment page.
        setRedirectPhase("redirecting");
      }
      if (result.data && handleCreditCardCheckoutRedirect(redirect, router)) {
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

  const busy = isPending || redirectPhase !== null;
  const ctaLabel = !signedIn ? (
    <>
      <LogIn aria-hidden className="size-4" />
      Giriş yap ve devam et
    </>
  ) : busy ? (
    <>
      <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
      Sipariş oluşturuluyor…
    </>
  ) : (
    <>
      <WalletCards aria-hidden className="size-4" />
      {selectedKind === "card" ? "Ödemeye geç" : "Siparişi tamamla"}
      <ArrowRight aria-hidden className="size-4" />
    </>
  );

  const summaryLines = (
    <OrderSummaryLines
      summary={summary}
      itemCount={totalItems}
      taxRate={taxRate}
      promoCode={appliedPromo?.code}
    />
  );

  return (
    <>
      <CheckoutHeader
        breadcrumbs={[{ label: "Sepet" }]}
        steps={<CheckoutSteps current={signedIn ? "bilgiler" : "sepet"} />}
        eyebrow="Sipariş"
        title="Sepetiniz"
        description={
          hasHydrated
            ? items.length > 0
              ? signedIn
                ? `Sepetinizde ${totalItems} ürün var. Bilgilerinizi kontrol edin, ödeme yöntemini seçip siparişinizi tamamlayın.`
                : `Sepetinizde ${totalItems} ürün var. Ödeme için giriş yapmanız gerekir.`
              : "Sepetinizde henüz ürün yok."
            : "Sepet yükleniyor…"
        }
      />

      <Section spacing="sm" className={items.length > 0 ? "max-lg:pb-36" : undefined}>
        {!hasHydrated ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]" aria-hidden>
            <div className="space-y-3">
              <div className="h-32 animate-pulse rounded-2xl border bg-muted/40" />
              <div className="h-32 animate-pulse rounded-2xl border bg-muted/40" />
            </div>
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
            <div className="min-w-0">
              <section id="sepet-urunleri" aria-labelledby="sepet-urunleri-baslik" className="scroll-mt-24">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2
                    id="sepet-urunleri-baslik"
                    className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    Sepetteki ürünler
                  </h2>
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={busy}
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
                    const quoteLine = quoteLines.get(item.id);
                    const periodChoices = quoteLine?.ok && quoteLine.periodOptions.length > 1 ? quoteLine.periodOptions : null;
                    const lineDiscount = quote && quoteLine?.ok ? quoteLine.discount : 0;
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
                              disabled={busy}
                              aria-label={`${item.title} ürününü sepetten kaldır`}
                              className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
                              {periodChoices ? (
                                <PeriodSwitch
                                  itemTitle={item.title}
                                  value={period}
                                  choices={periodChoices}
                                  disabled={busy}
                                  onChange={(choice) => handlePeriodChange(item, choice.period, choice.unitPrice)}
                                />
                              ) : (
                                <PeriodBadge period={period} />
                              )}
                              {item.type === "domain" && item.metadata?.renewPrice ? (
                                <p className="text-xs text-muted-foreground">
                                  Yenileme: {formatPrice(item.metadata.renewPrice)}/yıl +KDV
                                </p>
                              ) : null}
                            </div>
                            <div className="text-right" aria-live="polite">
                              <p className="font-semibold tabular-nums">{formatPrice(lineTotal)}</p>
                              <PeriodNote total={lineTotal} period={period} basis={basis} />
                              {lineDiscount > 0 ? (
                                <span className="block text-xs text-muted-foreground">
                                  İndirim: −{formatPrice(lineDiscount)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <BuyerInfoCard buyer={legal.buyer} signedIn={signedIn} />
            </div>

            <aside id="sepet-ozet" aria-labelledby="sepet-ozet-baslik" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl bg-muted/60 p-1.5 ring-1 ring-border dark:bg-muted/30">
                <div className="rounded-xl bg-background p-5 shadow-[0_6px_10px_-6px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
                  <h2 id="sepet-ozet-baslik" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Sipariş özeti
                  </h2>
                  <div className="mt-4">{summaryLines}</div>
                  {quoteError ? (
                    <p role="alert" className="mt-3 text-xs text-destructive">
                      {quoteError}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {hasYearly ? "Yıllık ödemeli ürünlerde 12 aylık tutar tek seferde faturalanır. " : null}
                    Her ürün için ayrı fatura düzenlenir.
                  </p>
                </div>

                <div className="space-y-5 p-5">
                  <CouponField
                    value={promoInput}
                    onValueChange={(value) => {
                      setPromoInput(value);
                      // Editing a rejected code stops re-checking it with every cart change.
                      if (promoCode && !appliedPromo) setPromoCode("");
                    }}
                    applied={appliedPromo}
                    pending={Boolean(promoCode) && quotePending}
                    error={promoError}
                    onApply={(code) => setPromoCode(code)}
                    onRemove={() => {
                      setPromoCode("");
                      setPromoInput("");
                    }}
                    disabled={busy}
                  />

                  <div id="sepet-odeme" className="scroll-mt-24">
                    <PaymentMethodPicker
                      options={paymentOptions.options}
                      otherCards={paymentOptions.otherCards}
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                      payableAmount={summary.total}
                      balance={paymentOptions.balance}
                      name="payment-method"
                    />
                  </div>

                  <div id="sepet-sozlesmeler" className="scroll-mt-24">
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
                      disabled={busy}
                    />
                  </div>

                  {emailVerified ? null : <EmailVerificationBanner email={userEmail} compact />}

                  <div ref={ctaRef} className="space-y-2">
                    {signedIn ? (
                      <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={busy || blocker !== null}
                        aria-describedby={blocker ? "sepet-cta-hint" : undefined}
                        className={buttonClasses({ size: "lg", className: "w-full disabled:opacity-60" })}
                      >
                        {ctaLabel}
                      </button>
                    ) : (
                      <Link href={LOGIN_HREF} className={buttonClasses({ size: "lg", className: "w-full" })}>
                        {ctaLabel}
                      </Link>
                    )}
                    {blocker && signedIn ? (
                      <p id="sepet-cta-hint" className="text-center text-xs text-muted-foreground">
                        {blocker.message}
                      </p>
                    ) : null}
                  </div>
                  {selectedGateway || !signedIn ? (
                    <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                      <Lock aria-hidden className="size-3 shrink-0" />
                      {selectedGateway
                        ? `Kart bilgileriniz ${selectedGateway} güvenli ödeme sayfasında girilir.`
                        : "Ödeme için müşteri hesabınızla giriş yapmanız gerekir."}
                    </p>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
        )}
      </Section>

      {hasHydrated && items.length > 0 ? (
        <MobileSummaryBar
          total={summary.total}
          estimated={summary.estimated}
          details={summaryLines}
          hidden={ctaVisible}
          hint={signedIn && blocker && blocker.target !== "sepet-ozet" && !busy ? blocker.message : null}
          action={
            signedIn ? (
              <button
                type="button"
                onClick={handleCheckout}
                disabled={busy}
                className={buttonClasses({ size: "md", className: "min-h-11 disabled:opacity-60" })}
              >
                {busy ? <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" /> : null}
                {selectedKind === "card" ? "Ödemeye geç" : "Siparişi tamamla"}
              </button>
            ) : (
              <Link href={LOGIN_HREF} className={buttonClasses({ size: "md", className: "min-h-11" })}>
                Giriş yap
              </Link>
            )
          }
        />
      ) : null}

      <PaymentRedirectOverlay phase={redirectPhase} gatewayName={selectedKind === "card" ? selectedGateway : null} />
    </>
  );
}
