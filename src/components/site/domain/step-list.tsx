import { cn } from "@/lib/utils";

export interface StepItem {
  title: string;
  description: string;
}

/**
 * Numbered process steps in a framed, dashed-separated grid.
 * Server component; no animation.
 */
export function StepList({
  steps,
  className,
}: {
  steps: StepItem[];
  className?: string;
}) {
  const cols =
    steps.length >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : steps.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <ol
      className={cn(
        "grid grid-cols-1 overflow-hidden rounded-xl border bg-background",
        "divide-y divide-dashed md:divide-y-0",
        cols,
        className
      )}
    >
      {steps.map((step, idx) => (
        <li
          key={step.title}
          className={cn(
            "relative p-6",
            // vertical dashed separators on wider screens
            "md:border-dashed",
            idx > 0 && "md:border-l",
            steps.length >= 4 && idx === 2 && "md:border-l-0 lg:border-l",
            steps.length >= 4 && idx >= 2 && "md:border-t md:border-dashed lg:border-t-0"
          )}
        >
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Adım {String(idx + 1).padStart(2, "0")}
          </span>
          <h3 className="mt-3 text-base font-semibold tracking-tight">{step.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
        </li>
      ))}
    </ol>
  );
}
