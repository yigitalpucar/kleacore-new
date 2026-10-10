"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, CreditCard, Loader2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buttonClasses } from "@/components/site/button-classes";
import {
  CARD_ERROR_MESSAGES,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  validateCard,
  type CardValidationError,
} from "@/lib/payments/card-validation";
import { PaymentRedirectOverlay, useResetOnPageShow } from "@/components/checkout/payment-redirect-overlay";

interface KuveytTurkCardFormProps {
  merchantOrderId: string;
  amountLabel: string;
  invoiceNumbers: string[];
  errorMessage?: string;
}

/**
 * Card form posted natively to /api/payments/kuveytturk/start, which answers
 * with the bank's 3-D Secure page. Card values live only in this component's
 * state; nothing is written to storage.
 */
export function KuveytTurkCardForm({
  merchantOrderId,
  amountLabel,
  invoiceNumbers,
  errorMessage,
}: KuveytTurkCardFormProps) {
  const [holderName, setHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [errors, setErrors] = useState<CardValidationError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Back from the bank page (bfcache): the form must be usable again.
  useResetOnPageShow(() => setSubmitting(false));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (submitting) {
      event.preventDefault();
      return;
    }
    const result = validateCard({ holderName, number: cardNumber, expiry, cvv });
    if (!result.ok) {
      event.preventDefault();
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setSubmitting(true);
  };

  const fieldError = (field: CardValidationError) =>
    errors.includes(field) ? (
      <p id={`card-${field}-error`} className="text-xs text-destructive">
        {CARD_ERROR_MESSAGES[field]}
      </p>
    ) : null;

  const describedBy = (field: CardValidationError) =>
    errors.includes(field) ? `card-${field}-error` : undefined;

  return (
    <div className="overflow-hidden rounded-2xl border bg-background">
      <div className="flex items-center gap-2 border-b px-5 py-3 text-xs text-muted-foreground">
        <Lock aria-hidden className="size-3.5" />
        <span className="font-mono uppercase tracking-[0.14em]">3D Secure · Kuveyt Türk Sanal POS</span>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {invoiceNumbers.length > 1 ? "Faturalar" : "Fatura"}
          </p>
          <p className="truncate font-mono text-sm">{invoiceNumbers.join(", ")}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Ödenecek tutar (tek çekim)</p>
          <p className="text-xl font-semibold tabular-nums">{amountLabel}</p>
        </div>
      </div>

      <form
        method="post"
        action="/api/payments/kuveytturk/start"
        onSubmit={handleSubmit}
        noValidate
        autoComplete="on"
        className="space-y-5 px-5 py-6"
      >
        <input type="hidden" name="ref" value={merchantOrderId} />

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="cardHolderName" className="text-sm font-medium">
            Kart üzerindeki ad soyad
          </label>
          <Input
            id="cardHolderName"
            name="cardHolderName"
            autoComplete="cc-name"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={64}
            value={holderName}
            onChange={(event) => setHolderName(event.target.value)}
            aria-invalid={errors.includes("holder")}
            aria-describedby={describedBy("holder")}
            className="h-11"
          />
          {fieldError("holder")}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="cardNumber" className="text-sm font-medium">
            Kart numarası
          </label>
          <div className="relative">
            <Input
              id="cardNumber"
              name="cardNumber"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              maxLength={23}
              value={cardNumber}
              onChange={(event) => setCardNumber(formatCardNumber(event.target.value))}
              aria-invalid={errors.includes("number")}
              aria-describedby={describedBy("number")}
              className="h-11 pr-10 font-mono tabular-nums"
            />
            <CreditCard
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          {fieldError("number")}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="cardExpiry" className="text-sm font-medium">
              Son kullanma (AA/YY)
            </label>
            <Input
              id="cardExpiry"
              name="cardExpiry"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="AA/YY"
              maxLength={5}
              value={expiry}
              onChange={(event) => setExpiry(formatExpiry(event.target.value))}
              aria-invalid={errors.includes("expiry")}
              aria-describedby={describedBy("expiry")}
              className="h-11 font-mono tabular-nums"
            />
            {fieldError("expiry")}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cardCvv" className="text-sm font-medium">
              Güvenlik kodu (CVV)
            </label>
            <Input
              id="cardCvv"
              name="cardCvv"
              type="password"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="•••"
              maxLength={4}
              value={cvv}
              onChange={(event) => setCvv(digitsOnly(event.target.value).slice(0, 4))}
              aria-invalid={errors.includes("cvv")}
              aria-describedby={describedBy("cvv")}
              className="h-11 font-mono tabular-nums"
            />
            {fieldError("cvv")}
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Ödeme tek çekim olarak alınır. Kart bilgileriniz yalnızca bankaya iletilir; KLEACORE tarafından
          saklanmaz veya kaydedilmez. Bir sonraki adımda bankanızın SMS doğrulama sayfası açılır.
        </p>

        <button
          type="submit"
          disabled={submitting}
          className={buttonClasses({ size: "lg", className: "w-full" })}
        >
          {submitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Lock aria-hidden className="size-4" />}
          {submitting ? "Bankaya yönlendiriliyor…" : `${amountLabel} öde`}
        </button>
      </form>
      <p className="border-t px-5 py-3 text-center text-xs text-muted-foreground">
        Visa, Mastercard ve Troy kartlar kabul edilir.
      </p>
      <PaymentRedirectOverlay phase={submitting ? "bank" : null} gatewayName="Kuveyt Türk 3D Secure" />
    </div>
  );
}
