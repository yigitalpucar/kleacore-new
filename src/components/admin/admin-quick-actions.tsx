"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminQuickAction } from "./admin-nav-config";

/** Top-bar "Hızlı işlemler": create shortcuts and the queues waiting on staff. */
export function AdminQuickActions({ create, queues }: { create: AdminQuickAction[]; queues: AdminQuickAction[] }) {
  if (create.length === 0 && queues.length === 0) return null;
  const waiting = queues.reduce((sum, q) => sum + (q.count ?? 0), 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={waiting > 0 ? `Hızlı işlemler, ${waiting} bekleyen iş` : "Hızlı işlemler"}
          className="relative inline-flex size-11 items-center justify-center gap-1.5 rounded-md border bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9 md:w-auto md:px-3"
        >
          <Plus aria-hidden className="size-4" />
          <span className="hidden md:inline">Hızlı işlem</span>
          {waiting > 0 ? (
            <span
              aria-hidden
              className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full border-2 border-background bg-red-600 px-1 text-center font-mono text-[10px] leading-4 tabular-nums text-white"
            >
              {waiting > 99 ? "99+" : waiting}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-72">
        {create.length > 0 ? (
          <>
            <DropdownMenuLabel className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Oluştur
            </DropdownMenuLabel>
            {create.map((a) => (
              <DropdownMenuItem key={a.href} asChild className="cursor-pointer">
                <Link href={a.href} className="flex items-center gap-2">
                  <a.icon aria-hidden className="size-4 text-muted-foreground" />
                  {a.title}
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
        {create.length > 0 && queues.length > 0 ? <DropdownMenuSeparator /> : null}
        {queues.length > 0 ? (
          <>
            <DropdownMenuLabel className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Bekleyen işler
            </DropdownMenuLabel>
            {queues.map((q) => (
              <DropdownMenuItem key={q.href} asChild className="cursor-pointer">
                <Link href={q.href} className="flex items-center gap-2">
                  <q.icon aria-hidden className="size-4 text-muted-foreground" />
                  <span className="flex-1">{q.title}</span>
                  <span
                    className={
                      q.count
                        ? "min-w-5 rounded border bg-background px-1.5 text-center font-mono text-[11px] tabular-nums text-foreground"
                        : "font-mono text-[11px] tabular-nums text-muted-foreground"
                    }
                  >
                    {q.count ?? 0}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
