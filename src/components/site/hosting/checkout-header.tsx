import { Breadcrumbs, type BreadcrumbItem } from "@/components/site/breadcrumbs";
import { Container } from "@/components/site/container";
import { Eyebrow } from "@/components/site/eyebrow";
import { GridBackground } from "@/components/site/grid-lines";
import { cn } from "@/lib/utils";

/** Compact page header for cart / checkout / payment result pages (holds the page's h1). */
export function CheckoutHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  icon,
  steps,
  align = "left",
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  icon?: React.ReactNode;
  /** Checkout progress (CheckoutSteps), shown above the title. */
  steps?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  const centered = align === "center";
  return (
    <section className={cn("relative isolate overflow-hidden border-b", className)}>
      <GridBackground className="-z-10" />
      <Container className={cn(steps ? "py-8 md:py-12" : "py-10 md:py-14")}>
        <div className={cn(centered && "mx-auto max-w-2xl text-center")}>
          {breadcrumbs?.length ? (
            <Breadcrumbs
              items={breadcrumbs}
              className={cn("mb-6", centered && "flex justify-center")}
            />
          ) : null}
          {steps ? <div className={cn("mb-8 max-w-xl", centered && "mx-auto")}>{steps}</div> : null}
          {icon ? (
            <div className={cn("mb-5 flex", centered && "justify-center")}>
              <span className="flex size-12 items-center justify-center rounded-xl border bg-background shadow-sm">
                {icon}
              </span>
            </div>
          ) : null}
          {eyebrow ? <Eyebrow className="mb-3">{eyebrow}</Eyebrow> : null}
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          {description ? (
            <p className={cn("mt-3 max-w-2xl text-pretty text-base text-muted-foreground", centered && "mx-auto")}>
              {description}
            </p>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
