"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppShellMenuContext } from "./app-shell";

export type AppBottomNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Small count dot text (hidden when 0 / null). */
  badge?: number | null;
  /** Extra paths that also mark this tab active (e.g. /sunucular under Hizmetler). */
  match?: string[];
};

function matches(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Phone tab bar (< md) for AppShell's `bottomBar` slot: up to four links plus
 * "Menü", which opens the shell's drawer. 56px targets, safe-area aware.
 */
export function AppBottomNav({ items, menuLabel = "Menü" }: { items: AppBottomNavItem[]; menuLabel?: string }) {
  const pathname = usePathname() ?? "";
  const menu = React.useContext(AppShellMenuContext);
  const activeHref = items.find((i) => matches(pathname, i.href, i.exact) || i.match?.some((m) => matches(pathname, m)))?.href;

  const cell =
    "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

  return (
    <nav
      aria-label="Alt menü"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch gap-1 px-2 py-1">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <li key={item.href} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(cell, active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {active ? <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-foreground" /> : null}
                <span className="relative">
                  <item.icon aria-hidden className="size-5" />
                  {item.badge ? (
                    <span className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-foreground px-1 text-center font-mono text-[9px] leading-4 text-background">
                      {item.badge > 99 ? "99+" : item.badge}
                      <span className="sr-only"> bekleyen</span>
                    </span>
                  ) : null}
                </span>
                <span className="truncate">{item.title}</span>
              </Link>
            </li>
          );
        })}
        {menu ? (
          <li className="flex flex-1">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={menu.menuOpen}
              onClick={menu.openMenu}
              className={cn(cell, "text-muted-foreground hover:text-foreground")}
            >
              <Menu aria-hidden className="size-5" />
              <span>{menuLabel}</span>
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
