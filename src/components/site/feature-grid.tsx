import { cn } from "@/lib/utils";
import { resolveIcon, type IconRef } from "./icon";

export interface FeatureItem {
  icon?: IconRef;
  title: string;
  description: string;
}

/**
 * Grid of features.
 * - `bordered` (default): cells separated by hairlines inside a framed box.
 * - `inline`: icon inline with the title, no box (lighter, for long lists).
 */
export function FeatureGrid({
  items,
  columns = 3,
  variant = "bordered",
  className,
}: {
  items: FeatureItem[];
  columns?: 2 | 3 | 4;
  variant?: "bordered" | "inline";
  className?: string;
}) {
  const cols =
    columns === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : columns === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-2 lg:grid-cols-3";

  if (variant === "inline") {
    return (
      <ul className={cn("grid gap-x-10 gap-y-8", cols, className)}>
        {items.map((item) => {
          const Icon = resolveIcon(item.icon);
          return (
            <li key={item.title}>
              <h3 className="flex items-center gap-2 text-base font-medium">
                {Icon ? <Icon aria-hidden className="size-4 shrink-0 text-foreground/80" /> : null}
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border bg-border",
        cols,
        className
      )}
    >
      {items.map((item) => {
        const Icon = resolveIcon(item.icon);
        return (
          <li
            key={item.title}
            className="group relative bg-background p-6 transition-colors hover:bg-muted/40 md:p-8"
          >
            {Icon ? (
              <span className="mb-5 flex size-10 items-center justify-center rounded-lg border bg-muted/40 transition-colors group-hover:bg-background">
                <Icon aria-hidden className="size-5 text-foreground/80" />
              </span>
            ) : null}
            <h3 className="text-base font-medium tracking-tight">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          </li>
        );
      })}
    </ul>
  );
}
