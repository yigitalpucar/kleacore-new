"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { previewCartQuote, type CartQuote } from "@/lib/actions/customer/cart-quote";
import { cartTotals } from "@/lib/billing/cart-totals";
import { useCartStore, type CartItem } from "@/store/cart-store";

export type CartQuoteStatus = "idle" | "loading" | "ready" | "error";

/** What the server needs to price a line (prices are never sent). */
export function quoteItemsPayload(items: CartItem[]) {
  return items.map((item) => ({
    id: item.id,
    type: item.type,
    quantity: item.quantity,
    metadata: {
      domain: item.metadata?.domain,
      planCode: item.metadata?.planCode,
      billingPeriod: item.metadata?.billingPeriod,
      category: item.metadata?.category,
      location: item.metadata?.location,
      subType: item.metadata?.subType,
      domainChoice: item.metadata?.domainChoice
        ? { type: item.metadata.domainChoice.type, domain: item.metadata.domainChoice.domain }
        : undefined,
      addons: item.metadata?.addons?.map((addon) => ({ sku: addon.sku })),
      configuration: item.metadata?.configuration,
      hostname: item.metadata?.hostname,
    },
  }));
}

export interface CartSummaryView {
  subtotal: number;
  promoDiscount: number;
  resellerDiscount: number;
  resellerPercent: number | null;
  taxAmount: number;
  total: number;
  /** True while the numbers are a local estimate waiting for the server quote. */
  estimated: boolean;
}

/**
 * Server quote of the cart (prices, promo, reseller discount, KDV) refreshed
 * whenever the cart or the applied coupon changes. Until it answers, the
 * summary shows the local estimate (cartTotals) so totals react instantly;
 * stale responses are dropped by sequence number. Line prices the server
 * reports differently (an old cart) are written back to the cart store.
 */
export function useCartQuote(items: CartItem[], promoCode: string, taxRate: number, enabled: boolean) {
  const syncItemPrices = useCartStore((state) => state.syncItemPrices);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [quotedKey, setQuotedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<CartQuoteStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);

  const payload = useMemo(() => quoteItemsPayload(items), [items]);
  const key = useMemo(() => JSON.stringify([payload, promoCode]), [payload, promoCode]);

  useEffect(() => {
    if (!enabled || payload.length === 0) {
      return;
    }
    const current = ++sequence.current;
    setStatus("loading");
    const timer = window.setTimeout(async () => {
      try {
        const result = await previewCartQuote({ items: payload, promoCode: promoCode || undefined });
        if (current !== sequence.current) return;
        if (!result.success) {
          setStatus("error");
          setError(result.error);
          return;
        }
        const prices: Record<string, number> = {};
        for (const line of result.data.lines) {
          if (line.ok) prices[line.id] = line.unitPrice;
        }
        syncItemPrices(prices);
        setQuote(result.data);
        setQuotedKey(key);
        setError(null);
        setStatus("ready");
      } catch {
        if (current !== sequence.current) return;
        setStatus("error");
        setError("Sepet tutarı doğrulanamadı. Bağlantınızı kontrol edip tekrar deneyin.");
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [enabled, key, payload, promoCode, syncItemPrices]);

  const local = cartTotals(items, taxRate);
  const fresh = status === "ready" && quote !== null && quotedKey === key;
  const lastHadDiscount = Boolean(quote && (quote.promoDiscount > 0 || quote.resellerDiscount > 0));

  const summary: CartSummaryView =
    fresh && quote
      ? {
          subtotal: quote.subtotal,
          promoDiscount: quote.promoDiscount,
          resellerDiscount: quote.resellerDiscount,
          resellerPercent: quote.resellerPercent,
          taxAmount: quote.taxAmount,
          total: quote.total,
          estimated: false,
        }
      : lastHadDiscount && quote
        ? {
            // Keep the discounted numbers on screen (dimmed) instead of
            // flashing the undiscounted estimate for a quarter second.
            subtotal: local.subtotal,
            promoDiscount: quote.promoDiscount,
            resellerDiscount: quote.resellerDiscount,
            resellerPercent: quote.resellerPercent,
            taxAmount: quote.taxAmount,
            total: quote.total,
            estimated: true,
          }
        : {
            subtotal: local.subtotal,
            promoDiscount: 0,
            resellerDiscount: 0,
            resellerPercent: null,
            taxAmount: local.taxAmount,
            total: local.total,
            estimated: enabled && items.length > 0,
          };

  return {
    quote: fresh ? quote : null,
    lastQuote: quote,
    status: enabled && items.length > 0 ? status : "idle",
    error,
    summary,
    pending: enabled && items.length > 0 && !fresh && status !== "error",
  };
}
