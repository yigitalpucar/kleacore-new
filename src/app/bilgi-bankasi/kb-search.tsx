"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Search } from "lucide-react";

export interface KbSearchItem {
  id: string;
  title: string;
  slug: string;
  tags: string[];
  categoryName: string;
  categorySlug: string;
}

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** In-page search over published article titles, categories and tags. */
export function KbSearch({ items }: { items: KbSearchItem[] }) {
  const [query, setQuery] = useState("");
  const listId = useId();
  const q = normalize(query.trim());

  const results = useMemo(() => {
    if (q.length < 2) return [];
    return items
      .filter((item) =>
        normalize([item.title, item.categoryName, ...item.tags].join(" ")).includes(q)
      )
      .slice(0, 8);
  }, [items, q]);

  return (
    <div className="mx-auto w-full max-w-2xl text-left">
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="kb-search" className="sr-only">
          Bilgi bankasında ara
        </label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            id="kb-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Makalelerde ara (örn: DNS, SSL, yedekleme)"
            aria-controls={listId}
            autoComplete="off"
            className="h-14 w-full rounded-lg border bg-background pl-12 pr-4 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </form>

      <div id={listId} aria-live="polite">
        {q.length >= 2 ? (
          results.length > 0 ? (
            <ul className="mt-2 divide-y overflow-hidden rounded-lg border bg-background shadow-sm">
              {results.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/bilgi-bankasi/${item.categorySlug}/${item.slug}`}
                    className="flex min-h-12 items-center gap-3 px-4 py-3 text-sm hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                  >
                    <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 font-medium">{item.title}</span>
                    <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:inline">
                      {item.categoryName}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground">
              &quot;{query.trim()}&quot; için makale bulunamadı. Farklı bir kelime deneyin.
            </p>
          )
        ) : null}
      </div>
    </div>
  );
}
