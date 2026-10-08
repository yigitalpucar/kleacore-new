import Link from "next/link";
import { cn } from "@/lib/utils";

export interface LinkTab {
  value: string;
  label: string;
  href: string;
  count?: number;
}

/**
 * Server-driven status tabs (the filter lives in the URL query), styled like
 * the DataTable's segmented filter so both kinds of list look the same.
 */
export function LinkTabs({ tabs, active, label }: { tabs: LinkTab[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8 md:px-2.5",
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span
                className={cn(
                  "font-mono text-[11px] tabular-nums",
                  isActive ? "text-background/70" : "text-muted-foreground/70"
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
