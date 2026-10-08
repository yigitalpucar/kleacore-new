"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Search, ShoppingCart, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { searchDomainAvailability } from "@/lib/actions/public/domains";
import { toast } from "@/lib/toast";
import { useCartStore } from "@/store/cart-store";
import { formatTRY } from "@/lib/format/price";
import { buttonClasses } from "@/components/site/button-classes";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { CornerTicks } from "@/components/site/grid-lines";

interface DomainResult {
  domain: string;
  available: boolean;
  price: number;
  renewPrice: number;
}

export interface DomainTldPrice {
  ext: string;
  price: number;
  renewPrice: number;
}

interface DomainSearchSectionProps {
  tlds: DomainTldPrice[];
  /** Section id used as the hero's "#alan-adi" anchor. */
  id?: string;
}

export function DomainSearchSection({ tlds, id = "alan-adi" }: DomainSearchSectionProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<DomainResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const addDomain = useCartStore((state) => state.addDomain);
  const inputId = useId();
  const hintId = useId();

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const result = await searchDomainAvailability(
        query,
        tlds.map((tld) => tld.ext),
      );

      if (!result.success || !result.data) {
        setResults([]);
        toast.error(result.error ?? "Domain sorgusu tamamlanamadı");
        return;
      }

      setResults(
        result.data.results.map((item) => ({
          domain: item.domain,
          available: item.available,
          price: item.price,
          renewPrice: item.renewPrice,
        })),
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToCart = (result: DomainResult) => {
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

  return (
    <Section id={id} tone="muted" divider className="scroll-mt-20">
      <SectionHeading
        align="center"
        eyebrow="Alan adı"
        title="Markanıza uygun alan adını bulun"
        description="Alan adınızı yazın, desteklenen uzantılarda müsaitliği ve yıllık fiyatı tek seferde görün."
        className="mb-10"
      />

      <form
        role="search"
        aria-label="Alan adı sorgulama"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSearch();
        }}
        className="relative mx-auto max-w-3xl"
      >
        <div className="relative rounded-xl border bg-background p-2 shadow-[0_16px_32px_-20px_rgba(0,0,0,0.25)] dark:shadow-none">
          <CornerTicks />
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <label htmlFor={inputId} className="sr-only">
                Alan adı
              </label>
              <Search
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id={inputId}
                type="text"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby={hintId}
                placeholder="ornek-sirket"
                className="h-12 w-full rounded-lg bg-transparent pl-12 pr-4 text-base outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring sm:h-14 sm:text-lg"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className={buttonClasses({ size: "lg", className: "h-12 sm:h-14 sm:px-8" })}
              disabled={isSearching || !query.trim()}
            >
              {isSearching ? (
                <>
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                  Sorgulanıyor…
                </>
              ) : (
                <>
                  <Search aria-hidden className="size-4" />
                  Sorgula
                </>
              )}
            </button>
          </div>
        </div>
        <p id={hintId} className="mt-3 text-center text-xs text-muted-foreground">
          Uzantı yazmanıza gerek yok; aşağıdaki uzantılarda birlikte sorgulanır. Fiyatlar yıllık ve KDV hariçtir.
        </p>
      </form>

      {tlds.length > 0 ? (
        <ul className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
          {tlds.slice(0, 8).map((tld) => (
            <li
              key={tld.ext}
              className="flex items-baseline justify-between gap-2 rounded-lg border border-dashed bg-background/60 px-3 py-2.5"
            >
              <span className="font-mono text-sm font-medium">{tld.ext}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatTRY(tld.price)}
                <span aria-hidden>/yıl</span>
                <span className="sr-only"> yıllık</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div aria-live="polite" className="mx-auto max-w-3xl">
        {isSearching ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 aria-hidden className="size-6 animate-spin text-muted-foreground" />
            <span className="sr-only">Sorgulanıyor</span>
          </div>
        ) : null}

        {!isSearching && hasSearched && results.length > 0 ? (
          <ul className="mt-8 divide-y divide-dashed overflow-hidden rounded-xl border bg-background">
            <AnimatePresence initial>
              {results.map((result, idx) => (
                <motion.li
                  key={result.domain}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={cn(
                    "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
                    !result.available && "text-muted-foreground"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full border",
                        result.available
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {result.available ? (
                        <Check aria-hidden className="size-4" />
                      ) : (
                        <X aria-hidden className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="break-words font-mono text-base font-medium text-foreground">
                        {result.domain}
                      </p>
                      <p className="text-xs">{result.available ? "Müsait" : "Kayıtlı"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    {result.available ? (
                      <>
                        <div className="text-left sm:text-right">
                          <p className="font-semibold tabular-nums text-foreground">
                            {formatTRY(result.price)}
                            <span className="text-xs font-normal text-muted-foreground"> /yıl +KDV</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Yenileme: {formatTRY(result.renewPrice)}/yıl
                          </p>
                        </div>
                        <button
                          type="button"
                          className={buttonClasses({ size: "md" })}
                          onClick={() => handleAddToCart(result)}
                        >
                          <ShoppingCart aria-hidden className="size-4" />
                          Sepete ekle
                        </button>
                      </>
                    ) : (
                      <Link
                        href={`/domain/whois?domain=${encodeURIComponent(result.domain)}`}
                        className={buttonClasses({ variant: "outline", size: "md" })}
                      >
                        Whois sorgula
                      </Link>
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : null}
      </div>
    </Section>
  );
}
