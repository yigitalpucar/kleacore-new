"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, RotateCcw, Search, ShoppingCart, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { formatTRY } from "@/lib/format/price";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/site/button-classes";
import { CornerTicks } from "@/components/site/grid-lines";
import { StatusDot } from "@/components/site/status-pill";
import { useCartStore } from "@/store/cart-store";
import { MAX_TLDS_PER_SEARCH, parseDomainQuery, pickSearchTlds } from "@/lib/domains/search-query";
import type { AvailabilityStatus } from "@/lib/domains/availability";

export interface DomainTldPrice {
  ext: string;
  price: number;
  renewPrice: number;
}

interface DomainSearchProps {
  /** Sold TLDs in display order, with their DB prices. */
  tlds: DomainTldPrice[];
  /** How many TLD price chips to show under the box (0 hides them). */
  chips?: number;
  /** Extension listed first when the visitor typed none (e.g. a picked .tr TLD card). */
  preferredExt?: string | null;
  inputRef?: React.Ref<HTMLInputElement>;
  /** Accessible name of the search form. */
  formLabel?: string;
  placeholder?: string;
}

interface SearchRow {
  domain: string;
  ext: string;
  status: AvailabilityStatus | "loading";
  price: number;
  renewPrice: number;
}

interface SearchResponse {
  label: string;
  results: Array<{ domain: string; ext: string; status: AvailabilityStatus; price: number; renewPrice: number }>;
}

const DEBOUNCE_MS = 450;
const MIN_LABEL_LENGTH = 2;

const STATUS_COPY: Record<SearchRow["status"], { label: string; hint: string }> = {
  available: { label: "Müsait", hint: "Kayıt kuruluşu kayda açık olduğunu doğruladı." },
  likely: { label: "Müsait görünüyor", hint: "Kayıt bulunamadı; kesin durum siparişte doğrulanır." },
  unknown: { label: "Doğrulanamadı", hint: "Şu anda kontrol edilemedi; siparişte doğrulanır." },
  registered: { label: "Kayıtlı", hint: "Bu alan adı başka biri adına kayıtlı." },
  loading: { label: "Kontrol ediliyor", hint: "" },
};

function StatusBadge({ status }: { status: SearchRow["status"] }) {
  if (status === "loading") {
    return (
      <span className="inline-flex h-6 w-28 animate-pulse rounded-full bg-muted motion-reduce:animate-none" aria-hidden />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        status === "registered" ? "border-dashed text-muted-foreground" : "bg-background text-foreground"
      )}
    >
      {status === "registered" ? (
        <X aria-hidden className="size-3" />
      ) : status === "unknown" ? (
        <AlertCircle aria-hidden className="size-3 text-muted-foreground" />
      ) : (
        <StatusDot tone={status === "available" ? "online" : "neutral"} pulse={false} />
      )}
      {STATUS_COPY[status].label}
    </span>
  );
}

function PriceBlock({ row, large }: { row: SearchRow; large?: boolean }) {
  if (row.price <= 0) {
    return <p className="text-xs text-muted-foreground">Fiyat için destek ekibine yazın</p>;
  }
  return (
    <div className={cn(large ? "text-left sm:text-right" : "text-left")}>
      <p className={cn("font-semibold tabular-nums", large ? "text-2xl tracking-tight" : "text-base")}>
        {formatTRY(row.price)}
        <span className="text-xs font-normal text-muted-foreground"> /ilk yıl +KDV</span>
      </p>
      {row.renewPrice > 0 && row.renewPrice !== row.price ? (
        <p className="text-xs text-muted-foreground">Yenileme: {formatTRY(row.renewPrice)}/yıl</p>
      ) : null}
    </div>
  );
}

function AddButton({
  row,
  inCart,
  onAdd,
  size = "md",
}: {
  row: SearchRow;
  inCart: boolean;
  onAdd: (row: SearchRow) => void;
  size?: "md" | "lg";
}) {
  if (row.status === "registered") {
    return (
      <Link
        href={`/domain/whois?domain=${encodeURIComponent(row.domain)}`}
        className={buttonClasses({ variant: "outline", size, className: "w-full sm:w-auto" })}
      >
        WHOIS sorgula
      </Link>
    );
  }
  if (inCart) {
    return (
      <Link
        href="/sepet"
        className={buttonClasses({ variant: "outline", size, className: "w-full sm:w-auto" })}
        aria-label={`${row.domain} sepette, sepete git`}
      >
        <Check aria-hidden className="size-4" />
        Sepette · Sepete git
      </Link>
    );
  }
  const disabled = row.status === "loading" || row.price <= 0;
  return (
    <button
      type="button"
      onClick={() => onAdd(row)}
      disabled={disabled}
      className={buttonClasses({ size, className: "w-full disabled:opacity-50 sm:w-auto" })}
      aria-label={`${row.domain} alan adını sepete ekle`}
    >
      <ShoppingCart aria-hidden className="size-4" />
      Sepete ekle
    </button>
  );
}

/**
 * Domain search with search-as-you-type: debounced, previous request aborted
 * on every keystroke, answers cached per query in the tab. The server checks
 * at most MAX_TLDS_PER_SEARCH TLDs per request (more on "Daha fazla uzantı")
 * and caches availability itself; /api/domain/search applies the per-query
 * and per-IP rate limits.
 */
export function DomainSearch({
  tlds,
  chips = 6,
  preferredExt = null,
  inputRef,
  formLabel = "Alan adı sorgulama",
  placeholder = "ornek-sirket",
}: DomainSearchProps) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [label, setLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState(1);
  const items = useCartStore((state) => state.items);
  const addDomain = useCartStore((state) => state.addDomain);
  const inputId = useId();
  const hintId = useId();
  const statusId = useId();
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<string, SearchResponse>());
  const timerRef = useRef<number | null>(null);

  const priceByExt = useMemo(() => new Map(tlds.map((tld) => [tld.ext, tld])), [tlds]);
  const soldExts = useMemo(() => tlds.map((tld) => tld.ext), [tlds]);
  const parsed = parseDomainQuery(query);
  const invalid = query.trim().length > 0 && !parsed;
  const typedExtUnsold = Boolean(parsed?.ext && !priceByExt.has(parsed.ext));
  const cartDomains = useMemo(
    () => new Set(items.filter((item) => item.type === "domain").map((item) => item.metadata?.domain ?? item.title)),
    [items]
  );

  const runSearch = useCallback(
    async (raw: string, batchCount: number) => {
      const target = parseDomainQuery(raw);
      abortRef.current?.abort();
      if (!target || target.label.length < MIN_LABEL_LENGTH) {
        setRows([]);
        setLabel(null);
        setLoading(false);
        setError(null);
        return;
      }
      const ordered = pickSearchTlds(soldExts, target.ext ?? preferredExt, soldExts.length);
      const wanted = ordered.slice(0, MAX_TLDS_PER_SEARCH * batchCount);
      const placeholder = (ext: string): SearchRow => ({
        domain: `${target.label}${ext}`,
        ext,
        status: "loading",
        price: priceByExt.get(ext)?.price ?? 0,
        renewPrice: priceByExt.get(ext)?.renewPrice ?? 0,
      });

      const chunks: string[][] = [];
      for (let index = 0; index < wanted.length; index += MAX_TLDS_PER_SEARCH) {
        chunks.push(wanted.slice(index, index + MAX_TLDS_PER_SEARCH));
      }
      const cached = chunks.map((chunk) => cacheRef.current.get(`${target.label}|${chunk.join(",")}`));
      const fromCache = (response: SearchResponse | undefined, chunk: string[]) =>
        chunk.map((ext) => {
          const hit = response?.results.find((result) => result.ext === ext);
          return hit ? { ...hit } : placeholder(ext);
        });

      setLabel(target.label);
      setError(null);
      setRows(chunks.flatMap((chunk, index) => fromCache(cached[index], chunk)));
      if (cached.every(Boolean)) {
        setLoading(false);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const responses = await Promise.all(
          chunks.map(async (chunk, index) => {
            if (cached[index]) return cached[index]!;
            const params = new URLSearchParams({ q: target.label, tlds: chunk.join(",") });
            const response = await fetch(`/api/domain/search?${params}`, { signal: controller.signal }).catch(
              (fetchError: unknown) => {
                if (controller.signal.aborted) throw fetchError;
                throw new Error("Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.");
              }
            );
            const body = await response.json().catch(() => null);
            if (!response.ok) {
              throw new Error(
                (body && typeof body.error === "string" && body.error) ||
                  "Sorgu şu anda tamamlanamadı. Lütfen tekrar deneyin."
              );
            }
            cacheRef.current.set(`${target.label}|${chunk.join(",")}`, body as SearchResponse);
            return body as SearchResponse;
          })
        );
        if (controller.signal.aborted) return;
        setRows(chunks.flatMap((chunk, index) => fromCache(responses[index], chunk)));
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "Sorgu şu anda tamamlanamadı.");
        // Keep prices on screen; availability is simply unknown.
        setRows((current) =>
          current.map((row) => (row.status === "loading" ? { ...row, status: "unknown" } : row))
        );
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    },
    [priceByExt, soldExts, preferredExt]
  );

  // Search as you type (debounced); every keystroke cancels the previous request.
  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void runSearch(query, batches), DEBOUNCE_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [query, batches, runSearch]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleAdd = (row: SearchRow) => {
    const added = addDomain({ domain: row.domain, price: row.price, renewPrice: row.renewPrice });
    if (added) toast.success(`${row.domain} sepete eklendi.`);
    else toast.info("Bu alan adı zaten sepetinizde.");
  };

  const [primary, ...alternatives] = rows;
  const remaining = label ? Math.max(0, soldExts.length - rows.length) : 0;
  const announce = !label
    ? ""
    : loading
      ? `${label} sorgulanıyor`
      : primary
        ? `${primary.domain}: ${STATUS_COPY[primary.status].label}. ${alternatives.length} uzantı daha listelendi.`
        : "";

  return (
    <div className="w-full text-left">
      <form
        role="search"
        aria-label={formLabel}
        onSubmit={(event) => {
          event.preventDefault();
          if (timerRef.current) window.clearTimeout(timerRef.current);
          void runSearch(query, batches);
        }}
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
                ref={inputRef}
                id={inputId}
                type="search"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="search"
                aria-describedby={hintId}
                aria-invalid={invalid}
                placeholder={placeholder}
                className="h-12 w-full rounded-lg bg-transparent pl-12 pr-10 text-base outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring sm:h-14 sm:text-lg [&::-webkit-search-cancel-button]:hidden"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setBatches(1);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && query) {
                    event.preventDefault();
                    setQuery("");
                  }
                }}
              />
              {loading ? (
                <Loader2
                  aria-hidden
                  className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground motion-safe:animate-spin"
                />
              ) : query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Aramayı temizle"
                  className="absolute right-1 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X aria-hidden className="size-4" />
                </button>
              ) : null}
            </div>
            <button
              type="submit"
              className={buttonClasses({ size: "lg", className: "h-12 sm:h-14 sm:px-8" })}
              disabled={!parsed}
            >
              <Search aria-hidden className="size-4" />
              Sorgula
            </button>
          </div>
        </div>
        <p
          id={hintId}
          className={cn("mt-3 text-center text-xs", invalid ? "text-destructive" : "text-muted-foreground")}
        >
          {invalid
            ? "Alan adı yalnızca harf (Türkçe karakter olmadan), rakam ve tire içerebilir."
            : `Yazdıkça sorgulanır; uzantı yazmanıza gerek yok. Fiyatlar yıllık ve KDV hariçtir.`}
        </p>
      </form>

      <p id={statusId} className="sr-only" aria-live="polite">
        {announce}
      </p>

      {chips > 0 && tlds.length > 0 && !label ? (
        <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tlds.slice(0, chips).map((tld) => (
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

      {label && primary ? (
        <div className="mt-6 space-y-4">
          {typedExtUnsold && parsed?.ext ? (
            <p className="rounded-lg border border-dashed bg-background/70 px-3 py-2.5 text-sm text-muted-foreground">
              <span className="font-mono">{parsed.ext}</span> uzantısını şu anda satmıyoruz. Aşağıdaki uzantılara göz
              atabilirsiniz.
            </p>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              <span className="flex items-start gap-2">
                <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
                {error}
              </span>
              <button
                type="button"
                onClick={() => void runSearch(query, batches)}
                className={buttonClasses({ variant: "outline", size: "sm", className: "min-h-9" })}
              >
                <RotateCcw aria-hidden className="size-3.5" />
                Tekrar dene
              </button>
            </div>
          ) : null}

          <section
            aria-label={`${primary.domain} sonucu`}
            aria-busy={primary.status === "loading"}
            className="relative overflow-hidden rounded-2xl border bg-background p-5 sm:p-6"
          >
            <CornerTicks />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <StatusBadge status={primary.status} />
                <p
                  className={cn(
                    "mt-3 font-mono text-2xl [overflow-wrap:anywhere] font-semibold tracking-tight sm:text-3xl",
                    primary.status === "registered" && "text-muted-foreground line-through decoration-1"
                  )}
                >
                  {primary.domain}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {primary.status === "loading" ? "Kayıt durumu kontrol ediliyor…" : STATUS_COPY[primary.status].hint}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:items-end">
                {primary.status === "registered" ? null : <PriceBlock row={primary} large />}
                <AddButton
                  row={primary}
                  inCart={cartDomains.has(primary.domain)}
                  onAdd={handleAdd}
                  size="lg"
                />
              </div>
            </div>
          </section>

          {alternatives.length > 0 ? (
            <section aria-labelledby={`${statusId}-alt`}>
              <h3
                id={`${statusId}-alt`}
                className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
              >
                Diğer uzantılar
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {alternatives.map((row) => (
                  <li
                    key={row.domain}
                    aria-busy={row.status === "loading"}
                    className={cn(
                      "flex flex-col justify-between gap-3 rounded-xl border bg-background p-4",
                      row.status === "registered" && "border-dashed bg-transparent"
                    )}
                  >
                    <div className="min-w-0 space-y-2">
                      <p
                        className={cn(
                          "font-mono text-sm font-medium [overflow-wrap:anywhere]",
                          row.status === "registered" && "text-muted-foreground"
                        )}
                      >
                        {row.domain}
                      </p>
                      <StatusBadge status={row.status} />
                    </div>
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      {row.status === "registered" ? (
                        <span className="text-xs text-muted-foreground">Başka biri adına kayıtlı</span>
                      ) : (
                        <PriceBlock row={row} />
                      )}
                      <AddButton row={row} inCart={cartDomains.has(row.domain)} onAdd={handleAdd} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {remaining > 0 ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setBatches((value) => value + 1)}
                disabled={loading}
                className={buttonClasses({ variant: "outline" })}
              >
                Daha fazla uzantı göster ({remaining})
              </button>
            </div>
          ) : null}

          <p className="text-xs leading-relaxed text-muted-foreground">
            “Müsait” yalnızca kayıt kuruluşu doğruladığında yazar. “Müsait görünüyor” ve “Doğrulanamadı” sonuçlarının
            kesin durumu sipariş aşamasında kayıt kuruluşu üzerinden kontrol edilir.
          </p>
        </div>
      ) : null}
    </div>
  );
}
