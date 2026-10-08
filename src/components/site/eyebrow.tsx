import { cn } from "@/lib/utils";

/** Mono, uppercase micro-label shown above headings and in cards. */
export function Eyebrow({
  children,
  className,
  dot = true,
}: {
  children: React.ReactNode;
  className?: string;
  /** Leading square marker (default true). */
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
        className
      )}
    >
      {dot ? <span aria-hidden className="size-1.5 shrink-0 bg-foreground/70" /> : null}
      {children}
    </span>
  );
}
