"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronUp, Loader2 } from "lucide-react";
import { formatTRY } from "@/lib/format/price";
import { cn } from "@/lib/utils";

/**
 * Phone-only sticky bar at the bottom of the cart: KDV-inclusive total, an
 * expandable breakdown and the primary action. Hidden while the in-page
 * summary's own button is on screen (`hidden`).
 */
export function MobileSummaryBar({
  total,
  estimated,
  details,
  action,
  hint,
  hidden,
}: {
  total: number;
  estimated: boolean;
  details: ReactNode;
  action: ReactNode;
  /** Why the action can't run yet ("Sözleşmeleri onaylayın"…). */
  hint?: string | null;
  hidden?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)] backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:hidden",
        "pb-[env(safe-area-inset-bottom)] transition-transform duration-200 motion-reduce:transition-none",
        hidden && !open ? "pointer-events-none translate-y-full" : "translate-y-0"
      )}
      aria-hidden={hidden && !open ? true : undefined}
      inert={hidden && !open ? true : undefined}
    >
      {open ? (
        <div id={detailsId} className="max-h-[50vh] overflow-y-auto border-b px-4 py-4">
          {details}
        </div>
      ) : null}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={detailsId}
          className="-ml-2 flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {estimated ? <Loader2 aria-hidden className="size-3 motion-safe:animate-spin" /> : null}
              Toplam · KDV dahil
            </span>
            <span className={cn("block text-lg font-semibold tabular-nums tracking-tight", estimated && "opacity-60")}>
              {formatTRY(total, { keepDecimals: true })}
            </span>
          </span>
          <ChevronUp
            aria-hidden
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !open && "rotate-180")}
          />
          <span className="sr-only">{open ? "Sipariş özetini gizle" : "Sipariş özetini göster"}</span>
        </button>
        <div className="shrink-0">{action}</div>
      </div>
      {hint ? <p className="-mt-1 px-4 pb-2 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
