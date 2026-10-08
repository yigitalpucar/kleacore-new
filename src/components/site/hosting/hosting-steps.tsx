import { cn } from "@/lib/utils";

export interface HostingStep {
  title: string;
  description: string;
}

/**
 * Numbered "how it works" steps joined by a dashed rail.
 * Vertical on phones, horizontal from `lg`.
 */
export function HostingSteps({ steps, className }: { steps: HostingStep[]; className?: string }) {
  const cols =
    steps.length >= 4 ? "lg:grid-cols-4" : steps.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";

  return (
    <ol className={cn("relative grid gap-8 lg:gap-6", cols, className)}>
      {steps.map((step, index) => (
        <li key={step.title} className="relative flex gap-4 lg:flex-col lg:gap-0">
          {index < steps.length - 1 ? (
            <>
              {/* vertical rail (phones/tablets) */}
              <span
                aria-hidden
                className="line-dashed-y absolute bottom-[-2rem] left-[19px] top-11 lg:hidden"
              />
              {/* horizontal rail (desktop) */}
              <span
                aria-hidden
                className="line-dashed-x absolute left-12 right-0 top-5 hidden lg:block"
              />
            </>
          ) : null}
          <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border bg-background font-mono text-xs font-medium tabular-nums shadow-sm">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 pb-1 lg:mt-6 lg:pr-6">
            <h3 className="text-base font-medium tracking-tight">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
