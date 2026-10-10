"use client";

import { Loader2 } from "lucide-react";
import { formatTRY } from "@/lib/format/price";
import { cn } from "@/lib/utils";
import type { CartSummaryView } from "./use-cart-quote";

function money(value: number) {
  return formatTRY(value, { keepDecimals: true });
}

/** Ara toplam / indirimler / KDV / toplam lines of the cart. */
export function OrderSummaryLines({
  summary,
  itemCount,
  taxRate,
  promoCode,
  className,
}: {
  summary: CartSummaryView;
  itemCount: number;
  taxRate: number;
  promoCode?: string | null;
  className?: string;
}) {
  const dim = summary.estimated ? "opacity-60 transition-opacity" : "transition-opacity";
  return (
    <dl className={cn("space-y-2 text-sm", className)} aria-busy={summary.estimated}>
      <div className="flex items-center justify-between gap-4">
        <dt className="text-muted-foreground">Ürün sayısı</dt>
        <dd className="tabular-nums">{itemCount}</dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt className="text-muted-foreground">Ara toplam (KDV hariç)</dt>
        <dd className="tabular-nums">{money(summary.subtotal)}</dd>
      </div>
      {summary.promoDiscount > 0 ? (
        <div className={cn("flex items-center justify-between gap-4", dim)}>
          <dt className="min-w-0 truncate text-muted-foreground">
            Kupon indirimi{promoCode ? <span className="font-mono"> · {promoCode}</span> : null}
          </dt>
          <dd className="tabular-nums">−{money(summary.promoDiscount)}</dd>
        </div>
      ) : null}
      {summary.resellerDiscount > 0 ? (
        <div className={cn("flex items-center justify-between gap-4", dim)}>
          <dt className="text-muted-foreground">
            Bayi indirimi{summary.resellerPercent ? ` (%${summary.resellerPercent})` : ""}
          </dt>
          <dd className="tabular-nums">−{money(summary.resellerDiscount)}</dd>
        </div>
      ) : null}
      <div className={cn("flex items-center justify-between gap-4", dim)}>
        <dt className="text-muted-foreground">KDV (%{taxRate})</dt>
        <dd className="tabular-nums">{money(summary.taxAmount)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t border-dashed pt-3">
        <dt className="font-medium">
          Toplam
          <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
            {summary.estimated ? (
              <>
                <Loader2 aria-hidden className="size-3 motion-safe:animate-spin" />
                Güncelleniyor…
              </>
            ) : (
              "KDV dahil"
            )}
          </span>
        </dt>
        <dd className={cn("text-2xl font-semibold tabular-nums tracking-tight", dim)}>{money(summary.total)}</dd>
      </div>
    </dl>
  );
}
