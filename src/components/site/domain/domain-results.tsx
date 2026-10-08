"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Info, ShoppingCart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTRY } from "@/lib/format/price";
import { buttonClasses } from "@/components/site/button-classes";
import { toast } from "@/lib/toast";
import { useCartStore } from "@/store/cart-store";

export interface DomainResultItem {
  domain: string;
  /**
   * `false` means the pre-check positively found a registration.
   * `true` only means no registration was found — the check can fail open
   * (registrar/RDAP unreachable), so the UI never presents it as "müsait".
   */
  available: boolean;
  price: number;
  renewPrice: number;
}

/**
 * Domain search results.
 *
 * Honesty rule: the search action reports `available: true` whenever it could
 * not confirm a registration (including when the registrar/RDAP lookup fails),
 * so those rows are shown as "Sipariş aşamasında doğrulanır" — never "Müsait".
 * Rows the action positively found registered are shown as "Kayıtlı".
 */
export function DomainResultList({
  results,
  className,
}: {
  results: DomainResultItem[];
  className?: string;
}) {
  const addDomain = useCartStore((state) => state.addDomain);
  const reduceMotion = useReducedMotion();

  const handleAdd = (result: DomainResultItem) => {
    const wasAdded = addDomain({
      domain: result.domain,
      price: result.price,
      renewPrice: result.renewPrice,
    });
    if (wasAdded) {
      toast.success(`${result.domain} sepete eklendi.`);
      return;
    }
    toast.info("Bu domain zaten sepetinizde.");
  };

  if (results.length === 0) return null;

  return (
    <div className={cn("text-left", className)}>
      <p className="mb-3 flex items-start gap-2 rounded-lg border border-dashed bg-background/70 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Bu liste bir ön sorgudur. Kayıtlı olduğu tespit edilen alan adları ayrıca işaretlenir; diğerlerinin kesin
          müsaitliği sipariş aşamasında kayıt kuruluşu üzerinden doğrulanır.
        </span>
      </p>
      <ul className="divide-y divide-dashed overflow-hidden rounded-xl border bg-background">
        {results.map((result, idx) => {
          const registered = !result.available;
          return (
            <motion.li
              key={result.domain}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border",
                    registered ? "bg-muted text-muted-foreground" : "bg-background text-foreground"
                  )}
                >
                  {registered ? <X className="size-4" /> : <span className="size-1.5 rounded-full bg-foreground/70" />}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "break-all font-mono text-base font-medium",
                      registered ? "text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {result.domain}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {registered ? "Kayıtlı — başka biri adına alınmış" : "Müsaitlik sipariş aşamasında doğrulanır"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap sm:justify-end">
                {registered ? (
                  <Link
                    href={`/domain/whois?domain=${encodeURIComponent(result.domain)}`}
                    className={buttonClasses({ variant: "outline", size: "md" })}
                  >
                    WHOIS sorgula
                  </Link>
                ) : (
                  <>
                    <div className="text-left sm:text-right">
                      {result.price > 0 ? (
                        <>
                          <p className="font-semibold tabular-nums text-foreground">
                            {formatTRY(result.price)}
                            <span className="text-xs font-normal text-muted-foreground"> /yıl +KDV</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Yenileme: {formatTRY(result.renewPrice)}/yıl
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Fiyat bilgisi için destek ekibine yazın</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/domain/whois?domain=${encodeURIComponent(result.domain)}`}
                        className={buttonClasses({ variant: "outline", size: "md", className: "px-3" })}
                        aria-label={`${result.domain} için WHOIS sorgula`}
                      >
                        WHOIS
                      </Link>
                      {result.price > 0 ? (
                        <button
                          type="button"
                          className={buttonClasses({ size: "md" })}
                          onClick={() => handleAdd(result)}
                          aria-label={`${result.domain} alan adını sepete ekle`}
                        >
                          <ShoppingCart aria-hidden className="size-4" />
                          Sepete ekle
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
