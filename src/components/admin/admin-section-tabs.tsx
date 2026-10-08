"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { findAdminSection, type AdminCounts } from "./admin-nav-config";

/**
 * Secondary navigation for admin sections with sub-routes (Müşteriler,
 * Siparişler, Hizmetler, Faturalar, Ürünler, İçerik). Rendered by the admin
 * shell above every page; shows only when the current path is one of the
 * section's tabs, so detail and edit pages stay clean.
 */
export function AdminSectionTabs({ counts }: { counts: AdminCounts }) {
  const pathname = usePathname() ?? "";
  const section = findAdminSection(pathname);
  const listRef = React.useRef<HTMLUListElement>(null);

  // Keep the active tab visible when the row scrolls (phones).
  React.useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !active) return;
    const left = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
    list.scrollLeft = Math.max(0, left);
  }, [pathname]);

  if (!section) return null;

  return (
    <nav aria-label={`${section.label} sayfaları`} className="-mx-4 md:mx-0">
      <ul ref={listRef} className="relative flex gap-1 overflow-x-auto border-b px-4 [scrollbar-width:none] md:px-0 [&::-webkit-scrollbar]:hidden">
        {section.tabs.map((tab) => {
          const active = tab.href === pathname;
          const count = tab.countKey ? counts[tab.countKey] : 0;
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-t-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:h-10",
                  active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.title}
                {count > 0 ? (
                  <span className="min-w-5 rounded border bg-background px-1.5 text-center font-mono text-[11px] tabular-nums text-foreground">
                    {count}
                  </span>
                ) : null}
                {active ? <span aria-hidden className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-foreground" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
