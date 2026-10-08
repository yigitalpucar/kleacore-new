"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TocItem {
  id: string;
  title: string;
  /** 2 = h2 (default), 3 = h3 (indented). */
  level?: 2 | 3;
}

function useActiveHeading(ids: string[]) {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);

  useEffect(() => {
    if (ids.length === 0 || typeof IntersectionObserver === "undefined") return;
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        const first = ids.find((id) => visible.get(id));
        if (first) setActive(first);
      },
      // Band just under the sticky header.
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

/** Sticky "İçindekiler" list with the current section highlighted (desktop). */
export function TocNav({
  items,
  title = "İçindekiler",
  className,
}: {
  items: TocItem[];
  title?: string;
  className?: string;
}) {
  const [ids] = useState(() => items.map((i) => i.id));
  const active = useActiveHeading(ids);

  if (items.length === 0) return null;

  return (
    <nav aria-label={title} className={className}>
      <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </p>
      <ol className="relative space-y-0.5 border-l">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "-ml-px block border-l py-1.5 pr-2 text-sm leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  item.level === 3 ? "pl-7" : "pl-4",
                  isActive
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                )}
              >
                {item.title}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Collapsible table of contents for phones/tablets. */
export function MobileToc({
  items,
  title = "İçindekiler",
  className,
}: {
  items: TocItem[];
  title?: string;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <details className={cn("group rounded-lg border bg-muted/30", className)}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <ol className="border-t px-2 py-2">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                "flex min-h-11 items-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                item.level === 3 && "pl-6"
              )}
            >
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </details>
  );
}
