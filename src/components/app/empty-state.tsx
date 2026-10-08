import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Empty / zero-data state. Dashed frame, icon tile, title, text, action slot.
 * Use `compact` inside cards and tables.
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
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className
      )}
    >
      {Icon ? (
        <span
          aria-hidden
          className={cn(
            "flex items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm",
            compact ? "size-9" : "size-11"
          )}
        >
          <Icon className={compact ? "size-4" : "size-5"} />
        </span>
      ) : null}
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
