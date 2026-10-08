"use client";

import { useId, useState } from "react";
import { ChevronDown, CreditCard, Landmark, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaymentOption } from "@/lib/payments/payment-options";

const ICONS = {
  card: CreditCard,
  bank_transfer: Landmark,
  balance: Wallet,
} as const;

interface PaymentMethodPickerProps {
  options: PaymentOption[];
  otherCards: PaymentOption[];
  value: string | null;
  onChange: (id: string) => void;
  /** Amount to pay; the balance option is disabled when the balance is lower. */
  payableAmount?: number;
  balance?: number | null;
  legend?: string;
  name?: string;
}

/**
 * Radio cards for the payment step (sepet + fatura ödeme). Shows only the
 * methods the server resolved as enabled and configured; extra card gateways
 * sit behind "Diğer kart ödeme seçenekleri".
 */
export function PaymentMethodPicker({
  options,
  otherCards,
  value,
  onChange,
  payableAmount,
  balance,
  legend = "Ödeme yöntemi",
  name,
}: PaymentMethodPickerProps) {
  const generatedName = useId();
  const groupName = name ?? `payment-method-${generatedName}`;
  const selectedIsOtherCard = otherCards.some((option) => option.id === value);
  const [showOtherCards, setShowOtherCards] = useState(selectedIsOtherCard);
  const otherCardsId = `${groupName}-other-cards`;

  if (options.length === 0 && otherCards.length === 0) {
    return (
      <div role="alert" className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Şu anda çevrim içi ödeme alınamıyor. Lütfen destek ekibimizle iletişime geçin.
      </div>
    );
  }

  const renderOption = (option: PaymentOption) => {
    const selected = value === option.id;
    const insufficient =
      option.kind === "balance" &&
      typeof balance === "number" &&
      typeof payableAmount === "number" &&
      balance < payableAmount;
    const Icon = ICONS[option.kind];

    return (
      <label
        key={option.id}
        className={cn(
          "flex items-start gap-3 rounded-xl border bg-background p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
          insufficient ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          selected ? "border-foreground ring-1 ring-foreground" : !insufficient && "hover:bg-muted/40"
        )}
      >
        <input
          type="radio"
          name={groupName}
          value={option.id}
          checked={selected}
          disabled={insufficient}
          onChange={() => onChange(option.id)}
          className="sr-only"
        />
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
          <Icon aria-hidden className="size-4 text-foreground/80" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{option.label}</span>
          <span className="block text-xs text-muted-foreground">
            {option.description}
            {insufficient ? " · Bu ödeme için yetersiz." : null}
          </span>
        </span>
        <span
          aria-hidden
          className={cn(
            "mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border",
            selected && "border-foreground"
          )}
        >
          {selected ? <span className="size-2 rounded-full bg-foreground" /> : null}
        </span>
      </label>
    );
  };

  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-2 space-y-2">{options.map(renderOption)}</div>

      {otherCards.length > 0 ? (
        <div className="mt-2">
          <button
            type="button"
            aria-expanded={showOtherCards || selectedIsOtherCard}
            aria-controls={otherCardsId}
            onClick={() => setShowOtherCards((open) => !open)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9"
          >
            Diğer kart ödeme seçenekleri
            <ChevronDown
              aria-hidden
              className={cn("size-4 transition-transform", (showOtherCards || selectedIsOtherCard) && "rotate-180")}
            />
          </button>
          {showOtherCards || selectedIsOtherCard ? (
            <div id={otherCardsId} className="mt-2 space-y-2">
              {otherCards.map(renderOption)}
            </div>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}
