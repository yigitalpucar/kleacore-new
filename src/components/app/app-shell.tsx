"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronRight, Menu, PanelLeftClose, PanelLeftOpen, X, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { RouteFade } from "./route-progress";

/* ------------------------------------------------------------------ types */

export type AppNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Count / short text on the right (e.g. unpaid invoices). Hidden when 0. */
  badge?: number | string | null;
  /** Active only on an exact path match (use for the dashboard root). */
  exact?: boolean;
  /** One line under the title in the top-bar mega menu. */
  description?: string;
};

export type AppNavGroup = {
  /** Mono micro-label above the group. */
  label?: string;
  /**
   * The label becomes a toggle that folds the group (needs `label`). Open by
   * default; the folded set is remembered per browser, and the group holding
   * the current page always stays open.
   */
  collapsible?: boolean;
  items: AppNavItem[];
};

export type AppShellUser = {
  name: string;
  email?: string | null;
};

export type AppShellProps = {
  nav: AppNavGroup[];
  /** Where the logo links to, and the label next to it ("Müşteri Paneli"). */
  brand: { href: string; label: string };
  /** Root crumb. Breadcrumbs are derived from the path below this href. */
  breadcrumbRoot: { label: string; href: string };
  /** Path segment → label overrides for crumbs ("yeni" → "Yeni talep"). */
  segmentLabels?: Record<string, string>;
  /**
   * Horizontal navigation under the top bar (e.g. a mega menu). When set, the
   * desktop sidebar is dropped and the logo moves into the top bar; phones
   * keep the drawer built from `nav`.
   */
  topNav?: React.ReactNode;
  /** Slots in the top bar, right side, in this order. */
  search?: React.ReactNode;
  quickActions?: React.ReactNode;
  notifications?: React.ReactNode;
  themeToggle?: React.ReactNode;
  userMenu?: React.ReactNode;
  /** Pinned to the bottom of the sidebar (secondary links, help card…). */
  sidebarFooter?: React.ReactNode;
  /** Fixed tab bar on phones (< md), e.g. <AppBottomNav />. Content gets bottom padding. */
  bottomBar?: React.ReactNode;
  children: React.ReactNode;
};

/** Lets the bottom bar's "Menü" tab open the mobile drawer. */
export const AppShellMenuContext = React.createContext<{ openMenu: () => void; menuOpen: boolean } | null>(null);

/* -------------------------------------------------------- breadcrumb ctx */

type CrumbOverrides = Record<string, string>;
const CrumbContext = React.createContext<{
  set: (segment: string, label: string | null) => void;
} | null>(null);

/**
 * Replace a path segment's crumb label from a page (e.g. an invoice id with
 * its number). Render anywhere inside AppShell:
 *   <AppBreadcrumbLabel segment={invoice.id} label={invoice.invoiceNumber} />
 */
export function AppBreadcrumbLabel({ segment, label }: { segment: string; label: string }) {
  const ctx = React.useContext(CrumbContext);
  React.useEffect(() => {
    ctx?.set(segment, label);
    return () => ctx?.set(segment, null);
  }, [ctx, segment, label]);
  return null;
}

const COLLAPSE_KEY = "kc-app-sidebar-collapsed";

function isActive(pathname: string, item: AppNavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function looksLikeId(segment: string) {
  return /^[a-z0-9]{20,}$/i.test(segment) || /^\d+$/.test(segment) || /^[0-9a-f-]{32,}$/i.test(segment) || /^fx_/.test(segment);
}

function humanize(segment: string) {
  const s = decodeURIComponent(segment).replace(/-/g, " ");
  return s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1);
}

/* ---------------------------------------------------------------- shell */

/**
 * Application shell: collapsible grouped sidebar (icon rail when collapsed),
 * mobile drawer, sticky top bar with breadcrumbs and slots. Provides a
 * TooltipProvider for everything inside.
 */
export function AppShell({
  nav,
  brand,
  breadcrumbRoot,
  segmentLabels = {},
  topNav,
  search,
  quickActions,
  notifications,
  themeToggle,
  userMenu,
  sidebarFooter,
  bottomBar,
  children,
}: AppShellProps) {
  const hasSidebar = !topNav;
  const pathname = usePathname() ?? breadcrumbRoot.href;
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [overrides, setOverrides] = React.useState<CrumbOverrides>({});

  React.useEffect(() => {
    try {
      // Reading a persisted UI preference after mount is intentional.
       
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Close the drawer on navigation.
  React.useEffect(() => {
     
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // ⌘B / Ctrl+B toggles the desktop sidebar (same shortcut as shadcn's sidebar).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b" && window.matchMedia("(min-width: 1024px)").matches) {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  const crumbCtx = React.useMemo(
    () => ({
      set: (segment: string, label: string | null) =>
        setOverrides((prev) => {
          if (label === null) {
            if (!(segment in prev)) return prev;
            const next = { ...prev };
            delete next[segment];
            return next;
          }
          return prev[segment] === label ? prev : { ...prev, [segment]: label };
        }),
    }),
    []
  );

  const crumbs = React.useMemo(() => {
    const items: { label: string; href: string }[] = [{ label: breadcrumbRoot.label, href: breadcrumbRoot.href }];
    if (!pathname.startsWith(breadcrumbRoot.href)) return items;
    const rest = pathname.slice(breadcrumbRoot.href.length).split("/").filter(Boolean);
    const navByHref = new Map(nav.flatMap((g) => g.items).map((i) => [i.href, i.title]));
    let href = breadcrumbRoot.href;
    for (const seg of rest) {
      href = `${href}/${seg}`;
      const label =
        overrides[seg] ?? navByHref.get(href) ?? segmentLabels[seg] ?? (looksLikeId(seg) ? "Detay" : humanize(seg));
      items.push({ label, href });
    }
    return items;
  }, [pathname, breadcrumbRoot, nav, segmentLabels, overrides]);

  return (
    <TooltipProvider delayDuration={200}>
      <CrumbContext.Provider value={crumbCtx}>
        <div className="min-h-screen bg-background">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:text-background"
          >
            İçeriğe geç
          </a>

          {/* Desktop sidebar */}
          {hasSidebar ? (
          <aside
            aria-label="Panel menüsü"
            className={cn(
              "fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-card/60 transition-[width] duration-200 lg:flex",
              collapsed ? "w-[64px]" : "w-64"
            )}
          >
            <SidebarBody
              nav={nav}
              brand={brand}
              pathname={pathname}
              collapsed={collapsed}
              footer={sidebarFooter}
              onToggle={toggleCollapsed}
            />
          </aside>
          ) : null}

          {/* Mobile drawer */}
          <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />
              <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-[300px] flex-col border-r bg-background shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left lg:hidden">
                <DialogPrimitive.Title className="sr-only">Panel menüsü</DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">Panel sayfaları arasında gezinin.</DialogPrimitive.Description>
                <SidebarBody nav={nav} brand={brand} pathname={pathname} collapsed={false} footer={sidebarFooter} />
                <DialogPrimitive.Close
                  aria-label="Menüyü kapat"
                  className="absolute right-2 top-2.5 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X aria-hidden className="size-4" />
                </DialogPrimitive.Close>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>

          <div
            className={cn(
              "flex min-h-screen flex-col transition-[padding] duration-200",
              hasSidebar && (collapsed ? "lg:pl-[64px]" : "lg:pl-64")
            )}
          >
            <div className="sticky top-0 z-30">
            {/* Top bar */}
            <header
              className={cn(
                "h-14 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70",
                hasSidebar && "px-2 sm:px-4 lg:px-6"
              )}
            >
              <div
                className={cn(
                  "flex h-full w-full items-center gap-2",
                  !hasSidebar && "mx-auto max-w-[1320px] px-2 sm:px-4 md:px-6 lg:px-8"
                )}
              >
              <button
                type="button"
                aria-label="Menüyü aç"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
              >
                <Menu aria-hidden className="size-5" />
              </button>

              {!hasSidebar ? (
                <Link
                  href={brand.href}
                  aria-label={`KLEACORE ${brand.label}`}
                  className="mr-2 hidden shrink-0 items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
                >
                  <Image src="/logo.svg" alt="" width={112} height={24} className="hidden h-[22px] w-auto dark:block" priority />
                  <Image
                    src="/logo-light.svg"
                    alt=""
                    width={112}
                    height={24}
                    className="h-[22px] w-auto [filter:brightness(0)_saturate(100%)] dark:hidden"
                    priority
                  />
                  <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {brand.label}
                  </span>
                  <span aria-hidden className="ml-2 hidden h-5 w-px bg-border md:block" />
                </Link>
              ) : null}

              <nav aria-label="Konum" className="min-w-0 flex-1">
                <ol className="flex min-w-0 items-center gap-1 text-sm">
                  {crumbs.map((c, i) => {
                    const last = i === crumbs.length - 1;
                    return (
                      <li
                        key={c.href}
                        className={cn("flex min-w-0 items-center gap-1", !last && "hidden md:flex")}
                      >
                        {i > 0 ? <ChevronRight aria-hidden className="hidden size-3.5 shrink-0 text-muted-foreground/60 md:block" /> : null}
                        {last ? (
                          <span aria-current="page" className="truncate font-medium text-foreground">
                            {c.label}
                          </span>
                        ) : (
                          <Link
                            href={c.href}
                            className="truncate rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {c.label}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>

              <div className="flex shrink-0 items-center gap-1">
                {search}
                {quickActions}
                {notifications}
                {themeToggle}
                {userMenu}
              </div>
              </div>
            </header>
            {topNav}
            </div>

            <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
              <RouteFade
                className={cn(
                  "mx-auto w-full max-w-[1320px] space-y-6 px-4 py-6 md:px-6 md:py-8 lg:px-8",
                  bottomBar && "pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8"
                )}
              >
                {children}
              </RouteFade>
            </main>
          </div>
          {bottomBar ? (
            <AppShellMenuContext.Provider value={{ openMenu: () => setMobileOpen(true), menuOpen: mobileOpen }}>
              {bottomBar}
            </AppShellMenuContext.Provider>
          ) : null}
        </div>
      </CrumbContext.Provider>
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------- sidebar */

function SidebarBody({
  nav,
  brand,
  pathname,
  collapsed,
  footer,
  onToggle,
}: {
  nav: AppNavGroup[];
  brand: AppShellProps["brand"];
  pathname: string;
  collapsed: boolean;
  footer?: React.ReactNode;
  onToggle?: () => void;
}) {
  return (
    <>
      <div className={cn("relative flex h-14 shrink-0 items-center gap-2", collapsed ? "justify-center px-2" : "px-4")}>
        <Link
          href={brand.href}
          aria-label={`KLEACORE ${brand.label}`}
          className="flex min-w-0 items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? (
            <span aria-hidden className="flex size-8 items-center justify-center rounded-md bg-foreground font-mono text-sm font-semibold text-background">
              K
            </span>
          ) : (
            <>
              <Image src="/logo.svg" alt="" width={112} height={24} className="hidden h-[22px] w-auto dark:block" priority />
              <Image
                src="/logo-light.svg"
                alt=""
                width={112}
                height={24}
                className="h-[22px] w-auto [filter:brightness(0)_saturate(100%)] dark:hidden"
                priority
              />
              <span className="truncate rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {brand.label}
              </span>
            </>
          )}
        </Link>
        <span aria-hidden className="line-dashed-x absolute inset-x-0 bottom-0" />
      </div>

      <nav aria-label="Ana menü" className="flex-1 overflow-y-auto overflow-x-hidden py-3 [scrollbar-width:thin]">
        {nav.map((group, gi) => (
          <NavGroup key={group.label ?? gi} group={group} first={gi === 0} pathname={pathname} collapsed={collapsed} />
        ))}
      </nav>

      {footer && !collapsed ? <div className="shrink-0 border-t border-dashed p-3">{footer}</div> : null}

      {onToggle ? (
        <div className={cn("flex shrink-0 border-t p-2", collapsed ? "justify-center" : "justify-end")}>
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
            title={collapsed ? "Menüyü genişlet (⌘B)" : "Menüyü daralt (⌘B)"}
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {collapsed ? <PanelLeftOpen aria-hidden className="size-4" /> : <PanelLeftClose aria-hidden className="size-4" />}
          </button>
        </div>
      ) : null}
    </>
  );
}

const FOLDED_GROUPS_KEY = "kc-nav-folded";

function readFolded(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(FOLDED_GROUPS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Folded group labels, shared by every NavGroup (desktop sidebar + drawer). */
function useFoldedGroup(label: string | undefined) {
  const [folded, setFolded] = React.useState(false);

  React.useEffect(() => {
    if (!label) return;
    const sync = () => setFolded(readFolded().includes(label));
    sync();
    window.addEventListener("kc-nav-folded", sync);
    return () => window.removeEventListener("kc-nav-folded", sync);
  }, [label]);

  const toggle = React.useCallback(() => {
    if (!label) return;
    const current = readFolded();
    const next = current.includes(label) ? current.filter((l) => l !== label) : [...current, label];
    try {
      window.localStorage.setItem(FOLDED_GROUPS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: still toggle for this page */
    }
    setFolded(next.includes(label));
    window.dispatchEvent(new Event("kc-nav-folded"));
  }, [label]);

  return [folded, toggle] as const;
}

function NavGroup({
  group,
  first,
  pathname,
  collapsed,
}: {
  group: AppNavGroup;
  first: boolean;
  pathname: string;
  collapsed: boolean;
}) {
  const foldable = Boolean(group.collapsible && group.label) && !collapsed;
  const [folded, toggle] = useFoldedGroup(foldable ? group.label : undefined);
  const hasActive = group.items.some((item) => isActive(pathname, item));
  const open = !foldable || !folded || hasActive;
  const listId = React.useId();
  const badgeTotal = group.items.reduce((sum, item) => sum + (typeof item.badge === "number" ? item.badge : 0), 0);

  return (
    <div className={cn("px-3", !first && (foldable ? "mt-2" : "mt-4"))}>
      {group.label ? (
        collapsed ? (
          <span aria-hidden className="line-dashed-x mx-auto mb-2 block w-6" />
        ) : foldable ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={listId}
            disabled={hasActive}
            title={hasActive ? "Açık sayfa bu grupta" : undefined}
            className="group/fold mb-0.5 flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-left font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:text-muted-foreground"
          >
            <span className="flex-1 truncate">{group.label}</span>
            {!open && badgeTotal > 0 ? (
              <span className="min-w-5 rounded border bg-background px-1.5 text-center font-mono text-[11px] normal-case tracking-normal tabular-nums text-foreground">
                {badgeTotal}
              </span>
            ) : null}
            <ChevronRight
              aria-hidden
              className={cn(
                "size-3.5 shrink-0 transition-transform motion-reduce:transition-none",
                open && "rotate-90",
                hasActive && "opacity-0"
              )}
            />
          </button>
        ) : (
          <p className="mb-1.5 px-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {group.label}
          </p>
        )
      ) : null}
      <ul id={listId} hidden={!open} className={cn("space-y-0.5", foldable && "mb-1")}>
          {group.items.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(pathname, item)} collapsed={collapsed} />
            </li>
          ))}
      </ul>
    </div>
  );
}

function NavLink({ item, active, collapsed }: { item: AppNavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  const showBadge = item.badge !== undefined && item.badge !== null && item.badge !== 0 && item.badge !== "";
  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.title : undefined}
      className={cn(
        "group relative flex h-11 items-center gap-2.5 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9",
        collapsed ? "justify-center px-0" : "px-2.5",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {active ? <span aria-hidden className="absolute -left-3 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r bg-foreground" /> : null}
      <Icon aria-hidden className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
      {collapsed ? (
        showBadge ? <span aria-hidden className="absolute right-2 top-2 size-1.5 rounded-full bg-foreground" /> : null
      ) : (
        <>
          <span className="flex-1 truncate">{item.title}</span>
          {showBadge ? (
            <span className="min-w-5 rounded border bg-background px-1.5 text-center font-mono text-[11px] tabular-nums text-foreground">
              {item.badge}
            </span>
          ) : null}
        </>
      )}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="bg-foreground text-background">
        {item.title}
        {showBadge ? ` · ${item.badge}` : ""}
      </TooltipContent>
    </Tooltip>
  );
}
