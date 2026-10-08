import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToneDot } from "./status-badge";
import type { StatusTone } from "./status-map";

export type StatCardProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Small text under the value ("3 tanesi 30 gün içinde yenilenecek"). */
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /** Makes the whole card a link. */
  href?: string;
  /** Adds a status dot before the hint (e.g. "danger" for overdue). */
  tone?: StatusTone;
  className?: string;
};

/** KPI tile. Monochrome; use `tone` only to flag attention. */
export function StatCard({ label, value, hint, icon: Icon, href, tone, className }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        {href ? (
          <ArrowUpRight
            aria-hidden
            className="size-4 text-muted-foreground/60 transition-colors group-hover:text-foreground"
          />
        ) : Icon ? (
          <Icon aria-hidden className="size-4 text-muted-foreground/70" />
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight md:text-[28px]">{value}</p>
      {hint ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
          {tone ? <ToneDot tone={tone} className="mt-[5px]" /> : null}
          <span className="line-clamp-2">{hint}</span>
        </p>
      ) : null}
    </>
  );

  const cls = cn("group relative block rounded-lg border bg-card p-4 shadow-sm md:p-5", className);

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          cls,
          "transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** Responsive grid for StatCards: 2 columns on phones, `columns` on lg. */
export function StatGrid({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  const lg = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" }[columns];
  return <div className={cn("grid grid-cols-2 gap-3 md:gap-4", lg, className)}>{children}</div>;
}
