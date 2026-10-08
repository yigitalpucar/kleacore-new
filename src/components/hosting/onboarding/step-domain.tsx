"use client";

import { useState, useTransition } from "react";
import { Globe, ArrowRight, Search, Check, Loader2, Link2 } from "lucide-react";
import { buttonClasses } from "@/components/site/button-classes";
import { formatTRY } from "@/lib/format/price";
import { cn } from "@/lib/utils";
import { ChoiceTile, StepHeading, StepNav, fieldClass } from "./step-shell";
import { searchDomainAvailability, type DomainAvailabilityResult } from "@/lib/actions/public/domains";
import type { DomainChoice } from "@/app/hosting/satin-al/[slug]/content";

interface StepDomainProps {
  domainChoice: DomainChoice;
  onDomainChoice: (choice: DomainChoice) => void;
  onNext: () => void;
}

const OPTIONS = [
  {
    type: "new" as const,
    title: "Yeni alan adı kaydet",
    description: "Uygun bir alan adı bulun ve siparişe ekleyin",
    icon: Globe,
  },
  {
    type: "existing" as const,
    title: "Mevcut alan adımı kullan",
    description: "Sahip olduğunuz alan adını bağlayın",
    icon: Link2,
  },
  {
    type: "later" as const,
    title: "Sonra karar vereceğim",
    description: "Alan adını sipariş sonrası belirleyin",
    icon: ArrowRight,
  },
];

export const StepDomain = ({ domainChoice, onDomainChoice, onNext }: StepDomainProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [existingDomain, setExistingDomain] = useState(domainChoice.domain ?? "");
  const [results, setResults] = useState<DomainAvailabilityResult[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    startTransition(async () => {
      const res = await searchDomainAvailability(searchQuery);
      if (res.success && res.data) {
        setResults(res.data.results);
      }
    });
  };

  const handleSelectDomain = (result: DomainAvailabilityResult) => {
    onDomainChoice({
      type: "new",
      domain: result.domain,
      price: result.price,
      renewPrice: result.renewPrice,
    });
  };

  const canContinue =
    domainChoice.type === "later" ||
    (domainChoice.type === "new" && domainChoice.domain) ||
    (domainChoice.type === "existing" && existingDomain.trim());

  return (
    <div className="space-y-8">
      <StepHeading
        eyebrow="Adım · Alan adı"
        title="Alan adınızı belirleyin"
        description="Hosting paketinizi kullanacağınız alan adını seçin. Bu adımı sonraya da bırakabilirsiniz."
      />

      <div role="group" aria-label="Alan adı seçeneği" className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((opt) => {
          const selected = domainChoice.type === opt.type;
          return (
            <ChoiceTile
              key={opt.type}
              selected={selected}
              onClick={() => {
                onDomainChoice({ type: opt.type });
                setResults([]);
              }}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="flex size-9 items-center justify-center rounded-md border bg-muted/40">
                  <opt.icon aria-hidden className="size-4 text-foreground/80" />
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full border",
                    selected && "border-foreground bg-foreground text-background"
                  )}
                >
                  {selected ? <Check className="size-2.5 stroke-[3]" /> : null}
                </span>
              </span>
              <span className="mt-4 block text-sm font-medium">{opt.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{opt.description}</span>
            </ChoiceTile>
          );
        })}
      </div>

      {domainChoice.type === "new" && (
        <div className="space-y-4">
          <form
            className="flex gap-2"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              handleSearch();
            }}
          >
            <label htmlFor="hosting-domain-search" className="sr-only">
              Alan adı ara
            </label>
            <input
              id="hosting-domain-search"
              className={fieldClass}
              placeholder="ornek.com"
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              type="submit"
              disabled={isPending}
              className={buttonClasses({ className: "shrink-0 px-4" })}
            >
              {isPending ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Search aria-hidden className="size-4" />
              )}
              <span className="hidden sm:inline">Sorgula</span>
              <span className="sr-only sm:hidden">Sorgula</span>
            </button>
          </form>

          {results.length > 0 && (
            <ul className="max-h-72 space-y-2 overflow-y-auto" aria-label="Sorgu sonuçları">
              {results.map((r) => {
                const selected = domainChoice.domain === r.domain;
                return (
                  <li key={r.domain}>
                    <ChoiceTile
                      selected={selected}
                      disabled={!r.available}
                      onClick={() => r.available && handleSelectDomain(r)}
                      className="flex min-h-11 items-center justify-between gap-3 px-4 py-3"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-sm">
                        {selected ? (
                          <Check aria-hidden className="size-4 shrink-0" />
                        ) : (
                          <Globe aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate font-medium">{r.domain}</span>
                      </span>
                      <span className="shrink-0 text-right text-sm">
                        {r.available ? (
                          <span className="font-medium tabular-nums">
                            {formatTRY(r.price)}
                            <span className="font-normal text-muted-foreground">/yıl</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Kayıtlı</span>
                        )}
                      </span>
                    </ChoiceTile>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {domainChoice.type === "existing" && (
        <div>
          <label htmlFor="hosting-existing-domain" className="text-sm font-medium">
            Mevcut alan adınız
          </label>
          <input
            id="hosting-existing-domain"
            className={cn(fieldClass, "mt-2")}
            placeholder="mevcut-alanadi.com"
            autoComplete="off"
            value={existingDomain}
            onChange={(e) => {
              setExistingDomain(e.target.value);
              onDomainChoice({ type: "existing", domain: e.target.value });
            }}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Sipariş sonrası alan adınızın DNS kayıtlarını hosting hesabınıza yönlendirmeniz gerekir.
          </p>
        </div>
      )}

      <StepNav onNext={onNext} nextDisabled={!canContinue} />
    </div>
  );
};
