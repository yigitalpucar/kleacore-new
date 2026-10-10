import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Empty / zero-data state: dashed frame, a small monochrome illustration
 * (icon tile on a dotted field with two ghost cards behind it), title, one
 * sentence and one primary action. Use `compact` inside cards and tables.
 * Customer panel lists use the presets in components/panel/panel-empty-state.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-12 md:py-14",
        className
      )}
    >
      {Icon ? (
        <div aria-hidden className={cn("relative flex items-center justify-center", compact ? "size-16" : "size-24")}>
          {/* dotted field, faded towards the edges */}
          <div
            className="absolute inset-0 text-foreground/15 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:8px_8px] [mask-image:radial-gradient(circle,black_35%,transparent_70%)]"
          />
          {compact ? null : (
            <>
              <span className="absolute size-11 -translate-x-3 translate-y-1 -rotate-6 rounded-md border border-dashed bg-background/60" />
              <span className="absolute size-11 translate-x-3 translate-y-1 rotate-6 rounded-md border border-dashed bg-background/60" />
            </>
          )}
          <span
            className={cn(
              "relative flex items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm",
              compact ? "size-9" : "size-12"
            )}
          >
            <Icon className={compact ? "size-4" : "size-5"} />
          </span>
        </div>
      ) : null}
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
