import { cn } from "@/lib/utils";

/**
 * Compact two-line row used for DataTable `mobileCard`s and simple lists:
 *   title ............ trailing
 *   subtitle
 *   meta (badges, dates)
 */
export function ListRow({
  title,
  subtitle,
  trailing,
  meta,
  leading,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  meta?: React.ReactNode;
  leading?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 gap-3", className)}>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-medium text-foreground">{title}</p>
          {trailing ? <div className="shrink-0 text-sm font-medium tabular-nums">{trailing}</div> : null}
        </div>
        {subtitle ? <p className="truncate text-[13px] text-muted-foreground">{subtitle}</p> : null}
        {meta ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5 text-xs text-muted-foreground">{meta}</div> : null}
      </div>
    </div>
  );
}

/** Square icon tile used as a leading visual in rows and headers. */
export function IconTile({
  children,
  size = "md",
  className,
}: {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm",
        size === "sm" && "size-8 [&_svg]:size-4",
        size === "md" && "size-10 [&_svg]:size-[18px]",
        size === "lg" && "size-12 [&_svg]:size-5",
        className
      )}
    >
      {children}
    </span>
  );
}
