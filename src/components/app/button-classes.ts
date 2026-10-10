import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "destructive" | "secondary";
type Size = "md" | "sm" | "icon" | "icon-sm";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const variants: Record<Variant, string> = {
  primary:
    "bg-foreground text-background shadow-[inset_0_-2px_0_0_rgba(255,255,255,0.18)] hover:bg-foreground/90 dark:shadow-[inset_0_-2px_0_0_rgba(0,0,0,0.12)]",
  outline: "border bg-background text-foreground shadow-sm hover:bg-muted/60",
  secondary: "bg-muted text-foreground hover:bg-muted/70",
  ghost: "text-foreground hover:bg-muted/60",
  destructive: "border border-red-500/30 bg-background text-red-600 shadow-sm hover:bg-red-500/10 dark:text-red-400",
};

// Phones get 44px targets; md+ uses the denser app sizes.
const sizes: Record<Size, string> = {
  md: "h-11 px-4 md:h-9 md:px-3.5",
  sm: "h-11 px-3 text-[13px] md:h-8 md:px-2.5",
  icon: "size-11 md:size-9",
  "icon-sm": "size-11 md:size-8",
};

/**
 * Class names for app buttons/links (denser than the site's `buttonClasses`).
 *   <Link className={appButton({ variant: "outline" })} href="…">…</Link>
 *   <button className={appButton()} type="submit">Kaydet</button>
 */
export function appButton({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}
