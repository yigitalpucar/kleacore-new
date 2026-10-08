"use client";

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTRY } from "@/lib/format/price";

export interface TldPriceRow {
  ext: string;
  category: string;
  registerPrice: number;
  renewPrice: number;
  transferPrice: number;
}

const ALL = "Tümü";

/**
 * Filterable TLD price list from the DB.
 * md+: a real <table>; phones: one card per TLD (no horizontal scroll).
 */
export function TldPriceTable({
  tlds,
  className,
  showFilters = true,
}: {
  tlds: TldPriceRow[];
  className?: string;
  showFilters?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const searchId = useId();

  const categories = useMemo(() => [ALL, ...Array.from(new Set(tlds.map((t) => t.category)))], [tlds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\.?/, ".");
    return tlds.filter(
      (t) => (category === ALL || t.category === category) && (q === "." || t.ext.toLowerCase().includes(q))
    );
  }, [tlds, query, category]);

  return (
    <div className={className}>
      {showFilters ? (
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="group"
            aria-label="Uzantı kategorisi"
            className="-mx-1 flex flex-wrap gap-1.5 px-1"
          >
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  "h-11 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  category === c
                    ? "border-foreground bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="relative w-full lg:w-72">
            <label htmlFor={searchId} className="sr-only">
              Uzantı ara
            </label>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id={searchId}
              type="search"
              placeholder="Uzantı ara (ör. .com.tr)"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      ) : null}

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border bg-background md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Alan adı uzantı fiyatları (KDV hariç)</caption>
          <thead>
            <tr className="border-b bg-muted/40 dark:bg-muted/20">
              {["Uzantı", "Kategori", "Kayıt", "Yenileme", "Transfer"].map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={cn(
                    "px-5 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground",
                    i < 2 ? "text-left" : "text-right"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.ext} className="border-b border-dashed last:border-b-0 hover:bg-muted/30">
                <th scope="row" className="px-5 py-3.5 text-left font-mono text-base font-semibold">
                  {t.ext}
                </th>
                <td className="px-5 py-3.5 text-muted-foreground">{t.category}</td>
                <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                  {formatTRY(t.registerPrice)}
                  <span className="font-normal text-muted-foreground">/yıl</span>
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums">
                  {formatTRY(t.renewPrice)}
                  <span className="text-muted-foreground">/yıl</span>
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums">{formatTRY(t.transferPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone cards */}
      <ul className="divide-y divide-dashed overflow-hidden rounded-xl border bg-background md:hidden">
        {filtered.map((t) => (
          <li key={t.ext} className="px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-lg font-semibold">{t.ext}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {t.category}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Kayıt</dt>
                <dd className="font-semibold tabular-nums">{formatTRY(t.registerPrice)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Yenileme</dt>
                <dd className="tabular-nums">{formatTRY(t.renewPrice)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Transfer</dt>
                <dd className="tabular-nums">{formatTRY(t.transferPrice)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
          Aramanızla eşleşen uzantı bulunamadı.
        </p>
      ) : null}

      <p className="mt-4 text-xs text-muted-foreground">
        Kayıt ve yenileme fiyatları yıllıktır, transfer tek seferliktir. Fiyatlara KDV dahil değildir; %20 KDV ödeme
        adımında eklenir.
      </p>
    </div>
  );
}
