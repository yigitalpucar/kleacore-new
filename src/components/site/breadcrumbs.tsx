import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  /** Omit for the current page (last item). */
  href?: string;
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://kleacore.com").replace(/\/+$/, "");
}

/**
 * Visible breadcrumb trail + BreadcrumbList JSON-LD.
 * "Ana Sayfa" is prepended automatically.
 */
export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  const trail: BreadcrumbItem[] = [{ label: "Ana Sayfa", href: "/" }, ...items];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${siteUrl()}${item.href === "/" ? "" : item.href}` } : {}),
    })),
  };

  return (
    <nav aria-label="Sayfa konumu" className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {trail.map((item, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "text-foreground" : undefined}>
                  {item.label}
                </span>
              )}
              {!last ? <ChevronRight aria-hidden className="size-3 opacity-60" /> : null}
            </li>
          );
        })}
      </ol>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </nav>
  );
}
