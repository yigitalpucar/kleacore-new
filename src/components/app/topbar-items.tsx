"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ChevronDown, Moon, Sun, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutButton } from "@/components/auth/logout-button";

const iconBtn =
  "relative inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-9";

/* --------------------------------------------------------------- theme */

export function AppThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      className={iconBtn}
      aria-label="Açık/koyu temayı değiştir"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun aria-hidden className="size-4 dark:hidden" />
      <Moon aria-hidden className="hidden size-4 dark:block" />
    </button>
  );
}

/* ----------------------------------------------------------- user menu */

export type AppUserMenuLink = { label: string; href: string; icon?: LucideIcon };

export function AppUserMenu({
  name,
  email,
  links = [],
}: {
  name: string;
  email?: string | null;
  links?: AppUserMenuLink[];
}) {
  const initial = name.trim().charAt(0).toLocaleUpperCase("tr-TR") || "K";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Hesap menüsü"
          className="ml-1 inline-flex h-11 items-center gap-2 rounded-md pl-1 pr-1.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9"
        >
          <span aria-hidden className="flex size-8 items-center justify-center rounded-md bg-foreground text-xs font-semibold text-background md:size-7">
            {initial}
          </span>
          <span className="hidden max-w-[140px] truncate font-medium xl:inline">{name}</span>
          <ChevronDown aria-hidden className="hidden size-3.5 text-muted-foreground sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{name}</p>
          {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
        </div>
        {links.length ? <DropdownMenuSeparator /> : null}
        {links.map((l) => (
          <DropdownMenuItem key={l.href} asChild className="cursor-pointer">
            <Link href={l.href} className="flex items-center gap-2">
              {l.icon ? <l.icon aria-hidden className="size-4 text-muted-foreground" /> : null}
              {l.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer p-0 text-red-600 focus:text-red-600 dark:text-red-400">
          <LogoutButton className="flex w-full items-center gap-2 px-2 py-1.5 text-sm" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AppCommandSearch, type AppSearchItem } from "./command-palette";
export { AppNotifications, type AppNotification } from "./notification-bell";
