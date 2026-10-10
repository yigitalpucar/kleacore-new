"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { AppNavGroup, AppNavItem } from "@/components/app";
import { cn } from "@/lib/utils";
import type { StaffRole } from "@/lib/auth/permissions";
import { adminGroupShortcuts } from "./admin-nav-config";

function isActive(pathname: string, item: AppNavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

const triggerClass =
  "group relative inline-flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:text-foreground";

function ActiveBar() {
  return <span aria-hidden className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-foreground" />;
}

function CountBadge({ value }: { value: number }) {
  return (
    <span className="min-w-5 rounded border bg-background px-1.5 text-center font-mono text-[11px] tabular-nums text-foreground">
      {value}
    </span>
  );
}

/**
 * Admin top navigation: one trigger per nav group, each opening a full-width
 * panel with the group's pages (icon, description, pending count) and a column
 * of one-click sub-pages. Desktop only; phones keep the drawer.
 */
export function AdminMegaMenu({ nav, role }: { nav: AppNavGroup[]; role: StaffRole }) {
  const pathname = usePathname() ?? "";
  const [value, setValue] = React.useState("");

  // Close the panel after navigation (clicks on links inside it, back/forward).
  React.useEffect(() => {
    setValue("");
  }, [pathname]);

  return (
    <NavigationMenu.Root
      value={value}
      onValueChange={setValue}
      delayDuration={120}
      aria-label="Yönetim menüsü"
      className="relative hidden border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 lg:block"
    >
      <div className="mx-auto w-full max-w-[1320px] px-4 md:px-6 lg:px-8">
        <NavigationMenu.List className="-mx-3 flex items-center gap-0.5">
          {nav.map((group, gi) => {
            if (!group.label) {
              return group.items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <NavigationMenu.Item key={item.href}>
                    <NavigationMenu.Link asChild active={active}>
                      <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(triggerClass, active && "text-foreground")}>
                        {item.title}
                        {active ? <ActiveBar /> : null}
                      </Link>
                    </NavigationMenu.Link>
                  </NavigationMenu.Item>
                );
              });
            }

            const active = group.items.some((item) => isActive(pathname, item));
            const pending = group.items.reduce((sum, item) => sum + (typeof item.badge === "number" ? item.badge : 0), 0);
            const shortcuts = adminGroupShortcuts(group, role);

            return (
              <NavigationMenu.Item key={group.label ?? gi} value={group.label}>
                <NavigationMenu.Trigger className={cn(triggerClass, active && "text-foreground")}>
                  {group.label}
                  {pending > 0 ? <CountBadge value={pending} /> : null}
                  <ChevronDown
                    aria-hidden
                    className="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                  />
                  {active ? <ActiveBar /> : null}
                </NavigationMenu.Trigger>
                <NavigationMenu.Content className="data-[motion^=from-]:animate-in data-[motion^=from-]:fade-in-0 motion-reduce:animate-none">
                  <div
                    className={cn(
                      "mx-auto grid w-full max-w-[1320px] gap-6 px-4 py-5 md:px-6 lg:px-8",
                      shortcuts.length > 0 && "lg:grid-cols-[minmax(0,1fr)_260px]"
                    )}
                  >
                    <ul className={cn("grid auto-rows-min content-start gap-1", shortcuts.length > 0 ? "grid-cols-3" : "grid-cols-4")}>
                      {group.items.map((item) => {
                        const itemActive = isActive(pathname, item);
                        const Icon = item.icon;
                        const badge = typeof item.badge === "number" && item.badge > 0 ? item.badge : null;
                        return (
                          <li key={item.href}>
                            <NavigationMenu.Link asChild active={itemActive}>
                              <Link
                                href={item.href}
                                aria-current={itemActive ? "page" : undefined}
                                className={cn(
                                  "group/item flex h-full items-start gap-3 rounded-lg border border-transparent p-3 outline-none transition-colors hover:border-border hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring",
                                  itemActive && "border-border bg-muted/60"
                                )}
                              >
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors group-hover/item:text-foreground">
                                  <Icon aria-hidden className="size-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <span className="truncate">{item.title}</span>
                                    {badge ? <CountBadge value={badge} /> : null}
                                  </span>
                                  {item.description ? (
                                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.description}</span>
                                  ) : null}
                                </span>
                              </Link>
                            </NavigationMenu.Link>
                          </li>
                        );
                      })}
                    </ul>

                    {shortcuts.length > 0 ? (
                      <div className="rounded-lg border border-dashed bg-muted/30 p-3">
                        <p className="px-2 pb-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Kısayollar
                        </p>
                        <ul className="space-y-0.5">
                          {shortcuts.map((tab) => (
                            <li key={tab.href}>
                              <NavigationMenu.Link asChild active={pathname === tab.href}>
                                <Link
                                  href={tab.href}
                                  className="group/sc flex h-8 items-center justify-between gap-2 rounded-md px-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <span className="truncate">{tab.title}</span>
                                  <ArrowUpRight aria-hidden className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover/sc:opacity-100" />
                                </Link>
                              </NavigationMenu.Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </NavigationMenu.Content>
              </NavigationMenu.Item>
            );
          })}
        </NavigationMenu.List>
      </div>

      {value ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-full z-30 h-screen bg-black/30 animate-in fade-in-0 motion-reduce:animate-none dark:bg-black/50"
        />
      ) : null}
      <div className="absolute inset-x-0 top-full z-40">
        <NavigationMenu.Viewport className="w-full overflow-hidden border-b bg-background shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none h-[var(--radix-navigation-menu-viewport-height)] transition-[height] duration-200 motion-reduce:transition-none" />
      </div>
    </NavigationMenu.Root>
  );
}
