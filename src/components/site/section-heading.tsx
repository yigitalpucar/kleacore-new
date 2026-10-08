import { cn } from "@/lib/utils";
import { Eyebrow } from "./eyebrow";

export interface SectionHeadingProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  /** Heading level. Pages have exactly one h1 (PageHeader / hero). */
  as?: "h1" | "h2" | "h3";
  /** Optional id for the heading (pair with Section `aria-labelledby`). */
  id?: string;
  /** Right-aligned actions (left alignment only, wraps below on mobile). */
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  as: Heading = "h2",
  id,
  actions,
  className,
}: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        !centered && actions && "md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className={cn("max-w-2xl", centered && "mx-auto text-center")}>
        {eyebrow ? <Eyebrow className="mb-4">{eyebrow}</Eyebrow> : null}
        <Heading
          id={id}
          className={cn(
            "text-balance font-semibold tracking-tight text-foreground",
            Heading === "h1"
              ? "text-4xl sm:text-5xl lg:text-6xl"
              : Heading === "h2"
                ? "text-3xl sm:text-4xl"
                : "text-xl sm:text-2xl"
          )}
        >
          {title}
        </Heading>
        {description ? (
          <p
            className={cn(
              "mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg",
              centered && "mx-auto"
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className={cn("flex flex-wrap gap-3", centered && "justify-center")}>{actions}</div>
      ) : null}
    </div>
  );
}
