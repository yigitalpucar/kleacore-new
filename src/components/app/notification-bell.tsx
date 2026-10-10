"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { ToneDot } from "./status-badge";

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  link?: string | null;
  type?: "INFO" | "WARNING" | "ERROR" | "SUCCESS" | string;
};

type BellData = { items: AppNotification[]; unread: number };

const typeTone = { INFO: "info", WARNING: "warning", ERROR: "danger", SUCCESS: "success" } as const;
const POLL_MS = 60_000;

const iconBtn =
  "relative inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-9";

/**
 * Bell + dropdown. Starts from the server-rendered `items` (no layout shift),
 * then refreshes from `endpoint` every 60 s while the tab is visible, on
 * focus and when opened. Items are marked read when followed; "Tümünü okundu
 * işaretle" clears the rest. The endpoint scopes everything to the session user.
 */
export function AppNotifications({
  items: initialItems,
  unread: initialUnread,
  endpoint = "/api/bildirimler",
  emptyText = "Yeni bildiriminiz yok.",
}: {
  items: AppNotification[];
  /** Total unread (may exceed the items shown). Defaults to the unread items. */
  unread?: number;
  /** `null` = static list (no polling, no mark-read). */
  endpoint?: string | null;
  emptyText?: string;
}) {
  const [data, setData] = React.useState<BellData>(() => ({
    items: initialItems,
    unread: initialUnread ?? initialItems.filter((n) => !n.isRead).length,
  }));
  const stopped = React.useRef(false);

  // A server re-render of the layout (router.refresh, server action) brings fresh props.
  React.useEffect(() => {
    setData({ items: initialItems, unread: initialUnread ?? initialItems.filter((n) => !n.isRead).length });
  }, [initialItems, initialUnread]);

  const refresh = React.useCallback(async () => {
    if (!endpoint || stopped.current) return;
    try {
      const res = await fetch(endpoint, { headers: { accept: "application/json" }, cache: "no-store" });
      if (res.status === 401) {
        stopped.current = true; // signed out in another tab
        return;
      }
      if (!res.ok) return;
      setData((await res.json()) as BellData);
    } catch {
      // offline: keep what we have, try again on the next tick
    }
  }, [endpoint]);

  React.useEffect(() => {
    if (!endpoint) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [endpoint, refresh]);

  const mark = React.useCallback(
    async (body: { ids: string[] } | { all: true }) => {
      // Optimistic: the dot and count update at once.
      setData((d) => {
        const ids = "all" in body ? null : new Set(body.ids);
        let changed = 0;
        const items = d.items.map((n) => {
          if (n.isRead || (ids && !ids.has(n.id))) return n;
          changed += 1;
          return { ...n, isRead: true };
        });
        return { items, unread: "all" in body ? 0 : Math.max(0, d.unread - changed) };
      });
      if (!endpoint) return;
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const next = (await res.json()) as BellData;
          setData({ items: next.items, unread: next.unread });
        }
      } catch {
        // next poll reconciles
      }
    },
    [endpoint]
  );

  const { items, unread } = data;
  const badge = unread > 9 ? "9+" : String(unread);

  return (
    <DropdownMenu onOpenChange={(open) => open && void refresh()}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={iconBtn}
          aria-label={unread ? `Bildirimler (${unread} okunmamış)` : "Bildirimler"}
        >
          <Bell aria-hidden className="size-4" />
          {unread ? (
            <span
              aria-hidden
              className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-background bg-foreground px-1 font-mono text-[9px] font-semibold leading-none text-background md:right-0.5 md:top-0.5"
            >
              {badge}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[min(calc(100vw-1.5rem),360px)] p-0">
        <div className="flex min-h-11 items-center justify-between gap-2 border-b px-3 py-1.5">
          <p className="text-sm font-semibold">
            Bildirimler
            {unread ? <span className="ml-2 hidden font-mono text-[11px] font-normal text-muted-foreground sm:inline">{unread} okunmamış</span> : null}
          </p>
          {unread && endpoint ? (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault(); // keep the list open
                void mark({ all: true });
              }}
              className="h-9 cursor-pointer gap-1.5 whitespace-nowrap px-2 text-xs text-muted-foreground md:h-7"
            >
              <CheckCheck aria-hidden className="size-3.5" />
              Tümünü okundu işaretle
            </DropdownMenuItem>
          ) : null}
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="max-h-[min(60vh,400px)] overflow-y-auto overscroll-contain py-1">
            {items.map((n) => {
              const inner = (
                <div className="flex w-full gap-2.5">
                  <ToneDot
                    tone={typeTone[n.type as keyof typeof typeTone] ?? "neutral"}
                    className={cn("mt-1.5", n.isRead && "opacity-40")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", n.isRead ? "text-muted-foreground" : "font-medium")}>
                      {n.title}
                      {n.isRead ? null : <span className="sr-only"> (okunmamış)</span>}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">{formatDateTime(n.createdAt)}</p>
                  </div>
                </div>
              );
              const onSelect = () => {
                if (!n.isRead) void mark({ ids: [n.id] });
              };
              return n.link ? (
                <DropdownMenuItem key={n.id} asChild onSelect={onSelect} className="cursor-pointer items-start px-3 py-2">
                  <Link href={n.link}>{inner}</Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem key={n.id} onSelect={onSelect} className="cursor-default items-start px-3 py-2">
                  {inner}
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
