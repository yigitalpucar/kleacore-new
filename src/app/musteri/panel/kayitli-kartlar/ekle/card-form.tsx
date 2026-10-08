"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, CreditCard, Loader2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { appButton } from "@/components/app";
import {
  CARD_ERROR_MESSAGES,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  validateCard,
  type CardValidationError,
} from "@/lib/payments/card-validation";

interface SavedCardFormProps {
  /** PayTR Direct API URL; the browser posts the card there, never to us. */
  action: string;
  /** Signed hidden fields (merchant, order, store_card=1, utoken…). No card data. */
  fields: Record<string, string>;
  amountLabel: string;
}

/**
 * "Kart ekle" form. Card values live only in this component's state and are
 * posted natively to PayTR (3D Secure follows); nothing is sent to KLEACORE.
 */
export function SavedCardForm({ action, fields, amountLabel }: SavedCardFormProps) {
  const [holderName, setHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [errors, setErrors] = useState<CardValidationError[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [expiryMonth = "", expiryYear = ""] = expiry.split("/");

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
  const describedBy = (field: CardValidationError) => (errors.includes(field) ? `card-${field}-error` : undefined);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3 text-xs text-muted-foreground">
        <Lock aria-hidden className="size-3.5" />
        <span className="font-mono uppercase tracking-[0.14em]">3D Secure · PayTR kart saklama</span>
      </div>

      <form method="post" action={action} onSubmit={handleSubmit} noValidate autoComplete="on" className="space-y-5 px-4 py-5">
        {Object.entries(fields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <input type="hidden" name="expiry_month" value={digitsOnly(expiryMonth)} />
        <input type="hidden" name="expiry_year" value={digitsOnly(expiryYear)} />
        <input type="hidden" name="card_number" value={digitsOnly(cardNumber)} />

        {errors.length > 0 ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>Kart bilgilerini kontrol edin.</span>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="cc_owner" className="text-sm font-medium">
            Kart üzerindeki ad soyad
          </label>
          <Input
            id="cc_owner"
            name="cc_owner"
            autoComplete="cc-name"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={50}
            value={holderName}
            onChange={(event) => setHolderName(event.target.value)}
            aria-invalid={errors.includes("holder")}
            aria-describedby={describedBy("holder")}
          />
          {fieldError("holder")}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="card-number-display" className="text-sm font-medium">
            Kart numarası
          </label>
          <div className="relative">
            {/* Display field has no name: the digits-only hidden input is what PayTR receives. */}
            <Input
              id="card-number-display"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              maxLength={23}
              value={cardNumber}
              onChange={(event) => setCardNumber(formatCardNumber(event.target.value))}
              aria-invalid={errors.includes("number")}
              aria-describedby={describedBy("number")}
              className="pr-10 font-mono tabular-nums"
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
            <label htmlFor="card-expiry" className="text-sm font-medium">
              Son kullanma (AA/YY)
            </label>
            <Input
              id="card-expiry"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="AA/YY"
              maxLength={5}
              value={expiry}
              onChange={(event) => setExpiry(formatExpiry(event.target.value))}
              aria-invalid={errors.includes("expiry")}
              aria-describedby={describedBy("expiry")}
              className="font-mono tabular-nums"
            />
            {fieldError("expiry")}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cvv" className="text-sm font-medium">
              Güvenlik kodu (CVV)
            </label>
            <Input
              id="cvv"
              name="cvv"
              type="password"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="•••"
              maxLength={4}
              value={cvv}
              onChange={(event) => setCvv(digitsOnly(event.target.value).slice(0, 4))}
              aria-invalid={errors.includes("cvv")}
              aria-describedby={describedBy("cvv")}
              className="font-mono tabular-nums"
            />
            {fieldError("cvv")}
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Kartınızı doğrulamak için {amountLabel} çekilir ve kart kaydedildikten sonra iade edilir. Bir sonraki adımda
          bankanızın 3D Secure doğrulama sayfası açılır.
        </p>

        <button type="submit" disabled={submitting} className={appButton({ variant: "primary", className: "w-full" })}>
          {submitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Lock aria-hidden className="size-4" />}
          {submitting ? "Bankaya yönlendiriliyor…" : "Kartı doğrula ve kaydet"}
        </button>
      </form>
    </div>
  );
}
