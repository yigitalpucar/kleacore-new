import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Page title row for app pages. Renders the page's single `<h1>`.
 *
 *   <PageHeader
 *     title="Faturalarım"
 *     description="Tüm faturalarınız ve ödeme durumları."
 *     actions={<Link className={appButton()} href="…">…</Link>}
 *   />
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  back,
  meta,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Mono micro-label above the title (e.g. an invoice number). */
  eyebrow?: React.ReactNode;
  /** Back link shown above the title. */
  back?: { href: string; label: string };
  /** Inline row under the description (status badge, dates…). */
  meta?: React.ReactNode;
  /** Right-aligned buttons; wraps below the title on phones. */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      {back ? (
        <Link
          href={back.href}
          className="-ml-1 inline-flex h-8 w-fit items-center gap-1.5 rounded-md px-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-1.5">
          {eyebrow ? (
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-balance break-words text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h1>
          {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
          {meta ? <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-sm text-muted-foreground">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">{actions}</div> : null}
      </div>
    </header>
  );
}
