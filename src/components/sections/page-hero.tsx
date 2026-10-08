import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import type { BreadcrumbItem } from "@/components/site/breadcrumbs";

/** @deprecated accent colours were removed (monochrome brand); kept for API compatibility. */
type PageHeroAccent = "default" | "emerald" | "sky" | "amber" | "violet";

interface PageHeroProps {
  badge?: string;
  /** @deprecated ignored — eyebrows are text-only now. */
  badgeIcon?: LucideIcon;
  title: string;
  /** Rendered as a muted second line of the title. */
  titleHighlight?: string;
  description: string;
  /** @deprecated ignored. */
  accent?: PageHeroAccent;
  breadcrumbs?: BreadcrumbItem[];
  children?: React.ReactNode;
  className?: string;
}

/**
 * Legacy inner-page hero. New pages should use `PageHeader` from
 * `@/components/site` directly; this wrapper maps the old props onto it.
 */
export function PageHero({
  badge,
  title,
  titleHighlight,
  description,
  breadcrumbs,
  children,
  className,
}: PageHeroProps) {
  return (
    <PageHeader
      eyebrow={badge}
      title={
        titleHighlight ? (
          <>
            {title} <span className="text-muted-foreground">{titleHighlight}</span>
          </>
        ) : (
          title
        )
      }
      description={description}
      breadcrumbs={breadcrumbs}
      className={className}
    >
      {children}
    </PageHeader>
  );
}
