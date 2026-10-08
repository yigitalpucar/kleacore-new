import { cn } from "@/lib/utils";
import { Container } from "@/components/site/container";
import { PageHeader } from "@/components/site/page-header";
import type { BreadcrumbItem } from "@/components/site/breadcrumbs";
import { SiteShell } from "./site-shell";
import { proseClasses } from "./prose";
import { MobileToc, TocNav, type TocItem } from "./toc";

/**
 * Long-form article frame (Aceternity "blog content with TOC"): left-aligned
 * header, sticky table of contents on desktop, collapsible TOC on phones,
 * readable prose column, optional sidebar block under the TOC and a footer
 * area under the article (tags, share, feedback).
 */
export function ArticleLayout({
  breadcrumbs,
  eyebrow,
  title,
  description,
  meta,
  toc,
  sidebar,
  footer,
  children,
  after,
}: {
  breadcrumbs: BreadcrumbItem[];
  eyebrow?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  toc: TocItem[];
  sidebar?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  after?: React.ReactNode;
}) {
  return (
    <SiteShell>
      <PageHeader
        align="left"
        beams={false}
        eyebrow={eyebrow}
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        className="[&_h1]:text-3xl [&_h1]:sm:text-4xl [&_h1]:lg:text-5xl"
      >
        {meta}
      </PageHeader>

      <section className="relative">
        <Container>
          <div className="grid gap-10 py-10 md:py-14 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <div className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-10 overflow-y-auto pb-6">
                <TocNav items={toc} title="Bu yazıda" />
                {sidebar}
              </div>
            </aside>

            <div className="min-w-0">
              <MobileToc items={toc} title="Bu yazıda" className="mb-10 lg:hidden" />
              <article className={cn("max-w-3xl", proseClasses)}>{children}</article>
              {footer ? <div className="mt-12 max-w-3xl space-y-8 border-t pt-8">{footer}</div> : null}
              {sidebar ? <div className="mt-12 max-w-3xl lg:hidden">{sidebar}</div> : null}
            </div>
          </div>
        </Container>
      </section>

      {after}
    </SiteShell>
  );
}

/** Mono meta line under the article title (date · reading time · author). */
export function ArticleMeta({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
      {items.filter(Boolean).map((item, i) => (
        <li key={i} className="flex items-center gap-3">
          {i > 0 ? <span aria-hidden className="size-1 rounded-full bg-muted-foreground/50" /> : null}
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Non-link tag chips (there are no tag routes). */
export function TagList({ tags, label = "Etiketler" }: { tags: string[]; label?: string }) {
  if (tags.length === 0) return null;
  return (
    <div>
      <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <ul className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <li key={tag} className="rounded-md border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
            {tag}
          </li>
        ))}
      </ul>
    </div>
  );
}
