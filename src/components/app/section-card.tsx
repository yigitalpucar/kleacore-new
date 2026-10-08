import { cn } from "@/lib/utils";

/**
 * The basic app surface: bordered card with an optional header row
 * (title + description + actions) and footer.
 *
 * `flush` removes body padding (for tables / lists that run edge to edge).
 */
export function SectionCard({
  title,
  description,
  actions,
  footer,
  children,
  flush = false,
  as: Tag = "section",
  headingLevel = 2,
  id,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  flush?: boolean;
  as?: "section" | "div" | "article" | "aside";
  headingLevel?: 2 | 3;
  id?: string;
  className?: string;
  bodyClassName?: string;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const headingId = id ? `${id}-title` : undefined;
  return (
    <Tag
      id={id}
      aria-labelledby={title && headingId ? headingId : undefined}
      className={cn("min-w-0 rounded-lg border bg-card text-card-foreground shadow-sm", className)}
    >
      {title || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3.5 md:px-5">
          <div className="min-w-0 space-y-0.5">
            {title ? (
              <Heading id={headingId} className="text-sm font-semibold tracking-tight">
                {title}
              </Heading>
            ) : null}
            {description ? <p className="text-[13px] text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children !== undefined && children !== null ? (
        <div className={cn(flush ? "" : "p-4 md:p-5", bodyClassName)}>{children}</div>
      ) : null}
      {footer ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/30 px-4 py-3 md:px-5">{footer}</div>
      ) : null}
    </Tag>
  );
}
