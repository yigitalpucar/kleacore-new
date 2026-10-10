"use client";

import { useId, type FormEvent } from "react";
import { AlertCircle, Loader2, TicketPercent, X } from "lucide-react";
import { formatTRY } from "@/lib/format/price";
import { cn } from "@/lib/utils";

/**
 * Coupon input with apply / remove. The code is checked by the cart quote
 * (server) — `pending` while it runs, `error` when it was rejected, and the
 * applied state shows the discount it gave.
 */
export function CouponField({
  value,
  onValueChange,
  applied,
  pending,
  error,
  onApply,
  onRemove,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  applied: { code: string; discount: number } | null;
  pending: boolean;
  error: string | null;
  onApply: (code: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const messageId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const code = value.trim().toUpperCase();
    if (!code || pending) return;
    onApply(code);
  };

  if (applied) {
    return (
      <div>
        <p className="text-sm font-medium">Kupon</p>
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <TicketPercent aria-hidden className="size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate font-mono text-sm font-medium">{applied.code}</span>
              <span className="block text-xs text-muted-foreground">
                {pending ? "Yeniden doğrulanıyor…" : `${formatTRY(applied.discount, { keepDecimals: true })} indirim uygulandı`}
              </span>
            </span>
          </span>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`${applied.code} kuponunu kaldır`}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="text-sm font-medium" htmlFor={inputId}>
        Kupon kodu
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id={inputId}
          value={value}
          onChange={(event) => onValueChange(event.target.value.toUpperCase())}
          placeholder="Kupon kodu"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={64}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={messageId}
          className={cn(
            "h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 font-mono text-sm uppercase shadow-sm placeholder:font-sans placeholder:normal-case placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            error && "border-destructive/60"
          )}
        />
        <button
          type="submit"
          disabled={disabled || pending || !value.trim()}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {pending ? <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" /> : null}
          {pending ? "Kontrol ediliyor" : "Uygula"}
        </button>
      </div>
      <p id={messageId} aria-live="polite" className={cn("mt-1.5 text-xs", error ? "text-destructive" : "text-muted-foreground")}>
        {error ? (
          <span className="inline-flex items-start gap-1">
            <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
            {error}
          </span>
        ) : (
          "İndirim, uygulandığında toplam tutara hemen yansır."
        )}
      </p>
    </form>
  );
}
