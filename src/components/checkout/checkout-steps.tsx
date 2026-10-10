import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckoutStepKey = "sepet" | "bilgiler" | "odeme" | "onay";
export type CheckoutStepState = "complete" | "current" | "upcoming" | "error";

export const CHECKOUT_STEPS: Array<{ key: CheckoutStepKey; label: string }> = [
  { key: "sepet", label: "Sepet" },
  { key: "bilgiler", label: "Bilgiler" },
  { key: "odeme", label: "Ödeme" },
  { key: "onay", label: "Onay" },
];

/**
 * State of every step given the current one: earlier steps are complete,
 * later ones upcoming. `error` marks the current step as failed (payment
 * declined) and `allComplete` ticks every step (order confirmed).
 */
export function checkoutStepStates(
  current: CheckoutStepKey,
  options: { error?: boolean; allComplete?: boolean } = {}
): Record<CheckoutStepKey, CheckoutStepState> {
  const currentIndex = CHECKOUT_STEPS.findIndex((step) => step.key === current);
  return Object.fromEntries(
    CHECKOUT_STEPS.map((step, index) => {
      let state: CheckoutStepState;
      if (options.allComplete || index < currentIndex) state = "complete";
      else if (index === currentIndex) state = options.error ? "error" : "current";
      else state = "upcoming";
      return [step.key, state];
    })
  ) as Record<CheckoutStepKey, CheckoutStepState>;
}

const STATE_LABEL: Record<CheckoutStepState, string> = {
  complete: "tamamlandı",
  current: "şu anki adım",
  upcoming: "sıradaki adım",
  error: "tamamlanamadı",
};

/** Sepet → Bilgiler → Ödeme → Onay progress, as an ordered list. */
export function CheckoutSteps({
  current,
  error,
  allComplete,
  className,
}: {
  current: CheckoutStepKey;
  error?: boolean;
  allComplete?: boolean;
  className?: string;
}) {
  const states = checkoutStepStates(current, { error, allComplete });
  return (
    <nav aria-label="Sipariş adımları" className={className}>
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {CHECKOUT_STEPS.map((step, index) => {
          const state = states[step.key];
          return (
            <li key={step.key} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 last:flex-none">
              <span
                aria-current={state === "current" || state === "error" ? "step" : undefined}
                className="flex min-w-0 items-center gap-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] tabular-nums transition-colors",
                    state === "complete" && "border-foreground bg-foreground text-background",
                    state === "current" && "border-foreground bg-background text-foreground ring-2 ring-foreground/15",
                    state === "upcoming" && "border-dashed text-muted-foreground",
                    state === "error" && "border-destructive bg-destructive/10 text-destructive"
                  )}
                >
                  {state === "complete" ? (
                    <Check className="size-3.5" />
                  ) : state === "error" ? (
                    <AlertCircle className="size-3.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    "truncate text-xs font-medium sm:text-sm",
                    state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                    state === "error" && "text-destructive",
                    // Phones show only the current step's label to stay on one line.
                    state !== "current" && state !== "error" && "max-sm:sr-only"
                  )}
                >
                  {step.label}
                  <span className="sr-only"> ({STATE_LABEL[state]})</span>
                </span>
              </span>
              {index < CHECKOUT_STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "h-px min-w-3 flex-1",
                    states[CHECKOUT_STEPS[index + 1].key] === "upcoming" ? "border-t border-dashed" : "bg-foreground/60"
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
