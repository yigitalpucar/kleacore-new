import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "inverted";
type Size = "md" | "lg" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  // Near-black in light mode, near-white in dark mode.
  primary:
    "bg-foreground text-background shadow-[inset_0_-2px_0_0_rgba(255,255,255,0.18)] hover:bg-foreground/90 dark:shadow-[inset_0_-2px_0_0_rgba(0,0,0,0.12)]",
  outline: "border bg-background text-foreground shadow-sm hover:bg-muted/60",
  ghost: "text-foreground hover:bg-muted/60",
  // For use on dark surfaces (featured card) in either theme.
  inverted: "bg-white text-neutral-950 hover:bg-white/90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3",
  md: "h-11 px-5",
  lg: "h-12 px-6 text-base",
};

/**
 * Class names for the site's link-buttons (`<Link className={buttonClasses()}>`).
 * All sizes except `sm` meet the 44px touch target.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}
