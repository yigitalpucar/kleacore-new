import { ArrowLeft, ArrowRight } from "lucide-react";
import { buttonClasses } from "@/components/site/button-classes";
import { Eyebrow } from "@/components/site/eyebrow";
import { cn } from "@/lib/utils";

/** Heading block shared by the hosting order steps. */
export function StepHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <Eyebrow className="mb-3">{eyebrow}</Eyebrow>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

/** Back / next row at the bottom of each step. */
export function StepNav({
  onBack,
  onNext,
  nextLabel = "Devam et",
  nextDisabled = false,
  nextIcon,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextIcon?: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
      <span aria-hidden className="line-dashed-x absolute inset-x-0 top-0" />
      {onBack ? (
        <button type="button" onClick={onBack} className={buttonClasses({ variant: "outline" })}>
          <ArrowLeft aria-hidden className="size-4" />
          Geri
        </button>
      ) : (
        <span className="hidden sm:block" />
      )}
      {onNext ? (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className={buttonClasses({ className: "disabled:pointer-events-none disabled:opacity-50" })}
        >
          {nextLabel}
          {nextIcon ?? <ArrowRight aria-hidden className="size-4" />}
        </button>
      ) : null}
    </div>
  );
}

/** Selectable tile (button with aria-pressed). */
export function ChoiceTile({
  selected,
  onClick,
  children,
  className,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative w-full rounded-xl border bg-background p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-foreground ring-1 ring-foreground"
          : "hover:border-foreground/30 hover:bg-muted/40",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
    >
      {children}
    </button>
  );
}

export const fieldClass =
  "h-11 w-full rounded-lg border bg-background px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
