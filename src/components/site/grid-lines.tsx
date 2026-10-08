import { cn } from "@/lib/utils";

/**
 * Thin dashed frame lines — the signature motif of the site.
 * Place inside a `relative` parent. Lines are decorative (aria-hidden).
 */
export function GridLineHorizontal({
  className,
  fade = true,
}: {
  className?: string;
  /** Fade both ends out (default true). */
  fade?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 line-dashed-x",
        fade && "mask-fade-x",
        className
      )}
    />
  );
}

export function GridLineVertical({
  className,
  fade = true,
}: {
  className?: string;
  fade?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 line-dashed-y",
        fade && "mask-fade-y",
        className
      )}
    />
  );
}

/**
 * Wraps content in a dashed frame whose lines run past the corners
 * (Aceternity "dashed grid lines" look). Horizontal overflow is clipped by
 * the lines' own masks, so it never causes page-level horizontal scroll.
 */
export function DashedFrame({
  children,
  className,
  overhang = true,
}: {
  children: React.ReactNode;
  className?: string;
  /** Let the lines extend beyond the frame corners (desktop only). */
  overhang?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <GridLineHorizontal
        className={cn("top-0", overhang && "md:-inset-x-10")}
      />
      <GridLineHorizontal
        className={cn("bottom-0", overhang && "md:-inset-x-10")}
      />
      <GridLineVertical className={cn("left-0", overhang && "md:-inset-y-10")} />
      <GridLineVertical className={cn("right-0", overhang && "md:-inset-y-10")} />
      {children}
    </div>
  );
}

/** Square background grid that fades out from the top (hero backgrounds). */
export function GridBackground({
  className,
  mask = "top",
}: {
  className?: string;
  mask?: "top" | "center" | "none";
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 bg-grid",
        mask === "top" && "mask-radial-top",
        mask === "center" && "mask-radial-center",
        className
      )}
    />
  );
}

/** Small corner ticks ("+") used to pin frames, e.g. on featured cards. */
export function CornerTicks({ className }: { className?: string }) {
  const tick =
    "pointer-events-none absolute size-2.5 border-foreground/40";
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <span className={cn(tick, "-left-px -top-px border-l border-t")} />
      <span className={cn(tick, "-right-px -top-px border-r border-t")} />
      <span className={cn(tick, "-bottom-px -left-px border-b border-l")} />
      <span className={cn(tick, "-bottom-px -right-px border-b border-r")} />
    </div>
  );
}
