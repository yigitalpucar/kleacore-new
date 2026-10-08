"use client";

import { useId, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { searchDomainAvailability } from "@/lib/actions/public/domains";
import { toast } from "@/lib/toast";
import { formatTRY } from "@/lib/format/price";
import { buttonClasses } from "@/components/site/button-classes";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { CornerTicks } from "@/components/site/grid-lines";
import { DomainResultList } from "@/components/site/domain/domain-results";

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
    } catch {
      setResults([]);
      toast.error("Domain sorgusu şu anda tamamlanamadı. Lütfen tekrar deneyin.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Section id={id} tone="muted" divider className="scroll-mt-20">
      <SectionHeading
        align="center"
        eyebrow="Alan adı"
        title="Markanıza uygun alan adını bulun"
        description="Alan adınızı yazın, desteklenen uzantılarda kayıt durumunu ve yıllık fiyatı tek seferde görün."
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
          <DomainResultList results={results} className="mt-8" />
        ) : null}
      </div>
    </Section>
  );
}
