"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Bell, ChevronDown, CornerDownLeft, Moon, Search, Sun, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutButton } from "@/components/auth/logout-button";
import { formatDateTime } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { ToneDot } from "./status-badge";
import type { AppNavGroup } from "./app-shell";

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

/* ------------------------------------------------------- notifications */

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  link?: string | null;
  type?: "INFO" | "WARNING" | "ERROR" | "SUCCESS" | string;
};

const typeTone = { INFO: "info", WARNING: "warning", ERROR: "danger", SUCCESS: "success" } as const;

/** Bell + dropdown list. Read-only: it shows what the server passes. */
export function AppNotifications({
  items,
  emptyText = "Yeni bildiriminiz yok.",
}: {
  items: AppNotification[];
  emptyText?: string;
}) {
  const unread = items.filter((n) => !n.isRead).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={iconBtn}
          aria-label={unread ? `Bildirimler (${unread} okunmamış)` : "Bildirimler"}
        >
          <Bell aria-hidden className="size-4" />
          {unread ? (
            <span aria-hidden className="absolute right-2 top-2 size-2 rounded-full border-2 border-background bg-foreground md:right-1.5 md:top-1.5" />
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[min(92vw,340px)] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Bildirimler</p>
          {unread ? <span className="font-mono text-[11px] text-muted-foreground">{unread} okunmamış</span> : null}
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="max-h-[360px] overflow-y-auto py-1">
            {items.map((n) => {
              const inner = (
                <div className="flex w-full gap-2.5">
                  <ToneDot tone={typeTone[n.type as keyof typeof typeTone] ?? "neutral"} className={cn("mt-1.5", n.isRead && "opacity-40")} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", n.isRead ? "text-muted-foreground" : "font-medium")}>{n.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">{formatDateTime(n.createdAt)}</p>
                  </div>
                </div>
              );
              return n.link ? (
                <DropdownMenuItem key={n.id} asChild className="cursor-pointer items-start px-3 py-2">
                  <Link href={n.link}>{inner}</Link>
                </DropdownMenuItem>
              ) : (
                <div key={n.id} className="px-3 py-2">
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------------------------------- command search */

export type AppSearchItem = { title: string; href: string; group?: string; icon?: LucideIcon; keywords?: string };

/**
 * "Go to" palette over the nav (+ extra items). Opens with ⌘K / Ctrl+K.
 * It only searches page links — no data search — so the placeholder says so.
 */
export function AppCommandSearch({
  nav,
  extra = [],
  placeholder = "Sayfa ara…",
}: {
  nav: AppNavGroup[];
  extra?: AppSearchItem[];
  placeholder?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);

  const all = React.useMemo<AppSearchItem[]>(
    () => [
      ...nav.flatMap((g) => g.items.map((i) => ({ title: i.title, href: i.href, icon: i.icon, group: g.label }))),
      ...extra,
    ],
    [nav, extra]
  );

  const results = React.useMemo(() => {
    const query = q.trim().toLocaleLowerCase("tr-TR");
    if (!query) return all;
    return all.filter((i) =>
      `${i.title} ${i.group ?? ""} ${i.keywords ?? ""}`.toLocaleLowerCase("tr-TR").includes(query)
    );
  }, [all, q]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
        setActive(0);
      }}
    >
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Sayfa ara"
          className={cn(
            iconBtn,
            "md:w-56 md:justify-start md:gap-2 md:border md:bg-background md:px-2.5 md:text-[13px] md:shadow-sm"
          )}
        >
          <Search aria-hidden className="size-4" />
          <span className="hidden flex-1 text-left md:inline">{placeholder}</span>
          <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] md:inline">⌘K</kbd>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <DialogPrimitive.Title className="sr-only">Sayfa ara</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Gitmek istediğiniz sayfanın adını yazın.</DialogPrimitive.Description>
          <div className="flex items-center gap-2 border-b px-3">
            <Search aria-hidden className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter" && results[active]) {
                  e.preventDefault();
                  go(results[active].href);
                }
              }}
              placeholder={placeholder}
              aria-label={placeholder.replace(/…$/, "")}
              role="combobox"
              aria-expanded="true"
              aria-controls="app-command-results"
              aria-activedescendant={results[active] ? `app-cmd-${active}` : undefined}
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul id="app-command-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">Eşleşen sayfa yok.</li>
            ) : (
              results.map((r, i) => {
                const Icon = r.icon;
                return (
                  <li
                    key={`${r.href}-${i}`}
                    id={`app-cmd-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.href)}
                    className={cn(
                      "flex h-11 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm",
                      i === active ? "bg-muted text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {Icon ? <Icon aria-hidden className="size-4 shrink-0" /> : null}
                    <span className="flex-1 truncate text-foreground">{r.title}</span>
                    {r.group ? <span className="font-mono text-[10px] uppercase tracking-wider">{r.group}</span> : null}
                    {i === active ? <CornerDownLeft aria-hidden className="size-3.5" /> : null}
                  </li>
                );
              })
            )}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
