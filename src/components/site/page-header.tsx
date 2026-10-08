import { cn } from "@/lib/utils";
import { Beams } from "./beams";
import { Breadcrumbs, type BreadcrumbItem } from "./breadcrumbs";
import { Container } from "./container";
import { Eyebrow } from "./eyebrow";
import { GridBackground, GridLineHorizontal } from "./grid-lines";

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  /** Trail after "Ana Sayfa"; the last item is the current page (no href). */
  breadcrumbs?: BreadcrumbItem[];
  /** Buttons / links rendered under the description. */
  actions?: React.ReactNode;
  /** Extra content under the actions (e.g. a BillingSwitch or search box). */
  children?: React.ReactNode;
  align?: "left" | "center";
  /** Animated beams on the background rails (default true). */
  beams?: boolean;
  className?: string;
}

/**
 * Inner-page hero: grid + beams background, breadcrumb, the page's single
 * <h1>, description, optional actions/children.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  breadcrumbs,
  actions,
  children,
  align = "center",
  beams = true,
  className,
}: PageHeaderProps) {
  const centered = align === "center";

  return (
    <section className={cn("relative isolate overflow-hidden border-b", className)}>
      <GridBackground className="-z-10" />
      {beams ? <Beams className="-z-10 hidden md:block" /> : null}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-background to-transparent"
      />

      <Container className="py-14 md:py-20 lg:py-24">
        <div className={cn("max-w-3xl", centered && "mx-auto text-center")}>
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <Breadcrumbs
              items={breadcrumbs}
              className={cn("mb-6", centered && "flex justify-center")}
            />
          ) : null}
          {eyebrow ? <Eyebrow className="mb-4">{eyebrow}</Eyebrow> : null}
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg",
                centered && "mx-auto"
              )}
            >
              {description}
            </p>
          ) : null}
          {actions ? (
            <div
              className={cn(
                "mt-8 flex flex-col gap-3 sm:flex-row",
                centered && "sm:justify-center"
              )}
            >
              {actions}
            </div>
          ) : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </Container>
      <GridLineHorizontal className="bottom-0" />
    </section>
  );
}
