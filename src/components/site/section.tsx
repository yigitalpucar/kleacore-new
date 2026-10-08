import { cn } from "@/lib/utils";
import { Container } from "./container";
import { GridLineHorizontal, GridLineVertical } from "./grid-lines";

type SectionTone = "default" | "muted" | "contrast";
type SectionSpacing = "none" | "sm" | "default" | "lg";

const tones: Record<SectionTone, string> = {
  default: "bg-background",
  muted: "bg-muted/40 dark:bg-muted/20",
  // Always-dark band (works in both themes).
  contrast: "dark bg-neutral-950 text-foreground",
};

const spacings: Record<SectionSpacing, string> = {
  none: "",
  sm: "py-12 md:py-16",
  default: "py-16 md:py-24",
  lg: "py-20 md:py-32",
};

export interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  tone?: SectionTone;
  spacing?: SectionSpacing;
  /** Container width. Pass `false` to render children without a Container. */
  container?: "default" | "narrow" | "wide" | false;
  containerClassName?: string;
  /** Dashed vertical rails at the container edges (desktop only). */
  rails?: boolean;
  /** Dashed line at the top of the section. */
  divider?: boolean;
}

/**
 * Vertical rhythm wrapper for every page section.
 * Use one `Section` per logical block; put a `SectionHeading` first.
 */
export function Section({
  tone = "default",
  spacing = "default",
  container = "default",
  containerClassName,
  rails = false,
  divider = false,
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn("relative overflow-x-clip", tones[tone], spacings[spacing], className)}
      {...props}
    >
      {divider ? <GridLineHorizontal className="top-0" /> : null}
      {container === false ? (
        children
      ) : (
        <Container size={container} className={containerClassName}>
          {rails ? (
            <>
              <GridLineVertical className="left-0 hidden md:block" fade={false} />
              <GridLineVertical className="right-0 hidden md:block" fade={false} />
            </>
          ) : null}
          {children}
        </Container>
      )}
    </section>
  );
}
