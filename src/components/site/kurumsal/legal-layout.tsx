import { COMPANY_INFO_DEFAULTS } from "@/lib/company-info";
import Link from "next/link";
import { ArrowUpRight, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/site/page-header";
import { Container } from "@/components/site/container";
import { GridLineVertical } from "@/components/site/grid-lines";
import { SiteShell } from "./site-shell";
import { proseClasses } from "./prose";
import { MobileToc, TocNav, type TocItem } from "./toc";

export const legalPolicies = [
  { title: "Kullanım Koşulları", href: "/yasal/kullanim-kosullari" },
  { title: "Gizlilik Politikası", href: "/yasal/gizlilik" },
  { title: "KVKK Aydınlatma Metni", href: "/yasal/kvkk" },
  { title: "Çerez Politikası", href: "/yasal/cerez" },
  { title: "İade Koşulları", href: "/yasal/iade-kosullari" },
];

/**
 * Shared frame for /yasal/* pages: header with last-updated date, sticky
 * table of contents (desktop) / collapsible TOC (mobile), readable prose
 * column and links to the other policies.
 */
export function LegalLayout({
  title,
  description,
  path,
  updated,
  sections,
  children,
}: {
  title: string;
  description: string;
  /** Current page path, e.g. "/yasal/kvkk" (excluded from "Diğer politikalar"). */
  path: string;
  /** Human-readable last-updated date, e.g. "11 Ocak 2026". */
  updated: string;
  sections: TocItem[];
  children: React.ReactNode;
}) {
  const others = legalPolicies.filter((p) => p.href !== path);

  return (
    <SiteShell>
      <PageHeader
        align="left"
        beams={false}
        eyebrow="Yasal"
        title={title}
        description={description}
        breadcrumbs={[{ label: "Yasal" }, { label: title }]}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Son güncelleme: <time className="text-foreground">{updated}</time>
        </p>
      </PageHeader>

      <section className="relative">
        <Container>
          <GridLineVertical className="left-[19rem] hidden lg:block xl:left-[20rem]" fade={false} />
          <div className="grid gap-10 py-10 md:py-14 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <div className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-10 overflow-y-auto pb-6">
                <TocNav items={sections} />
                <OtherPolicies items={others} />
              </div>
            </aside>

            <div className="min-w-0">
              <MobileToc items={sections} className="mb-10 lg:hidden" />
              <article className={cn("max-w-3xl", proseClasses)}>{children}</article>
              <OtherPolicies items={others} className="mt-16 border-t pt-8 lg:hidden" />
            </div>
          </div>
        </Container>
      </section>
    </SiteShell>
  );
}

function OtherPolicies({
  items,
  className,
}: {
  items: { title: string; href: string }[];
  className?: string;
}) {
  return (
    <nav aria-label="Diğer politikalar" className={className}>
      <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Diğer politikalar
      </p>
      <ul className="space-y-0.5">
        {items.map((policy) => (
          <li key={policy.href}>
            <Link
              href={policy.href}
              className="group flex min-h-10 items-center justify-between gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {policy.title}
              <ArrowUpRight
                aria-hidden
                className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ---------- content blocks ---------- */

/** One numbered section of a policy (anchor target for the TOC). */
export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-baslik`} className="scroll-mt-28">
      <h2 id={`${id}-baslik`}>{title}</h2>
      {children}
    </section>
  );
}

/** Framed list of rows (title + optional description / trailing value). */
export function LegalRows({
  rows,
  className,
}: {
  rows: { title: React.ReactNode; description?: React.ReactNode; value?: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("not-prose my-6 divide-y overflow-hidden rounded-lg border", className)}>
      {rows.map((row, i) => (
        <div key={i} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{row.title}</p>
            {row.description ? (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{row.description}</p>
            ) : null}
          </div>
          {row.value ? (
            <p className="shrink-0 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground sm:pt-0.5">
              {row.value}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Highlighted note. `tone="warning"` adds a stronger left rule. */
export function LegalCallout({
  title,
  children,
  tone = "note",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "note" | "warning";
}) {
  return (
    <div
      role="note"
      className={cn(
        "not-prose my-6 rounded-r-lg border border-l-2 bg-muted/40 p-4 sm:p-5",
        tone === "warning" ? "border-l-foreground" : "border-l-foreground/40"
      )}
    >
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-foreground">
        {title}
      </p>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

/** Bulleted list inside a framed box (e.g. "İade yapılamayan hizmetler"). */
export function LegalBoxList({
  title,
  items,
  marker = "dash",
}: {
  title: string;
  items: React.ReactNode[];
  marker?: "dash" | "cross" | "check";
}) {
  const sign = marker === "cross" ? "×" : marker === "check" ? "✓" : "–";
  return (
    <div className="not-prose my-6 rounded-lg border p-4 sm:p-5">
      <p className="mb-3 text-sm font-medium text-foreground">{title}</p>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span aria-hidden className="mt-px w-3 shrink-0 font-mono text-foreground/60">
              {sign}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Company / contact card closing each policy. */
export function LegalContactCard({
  heading = COMPANY_INFO_DEFAULTS.name,
  emails,
  showEin = true,
}: {
  heading?: string;
  emails: string[];
  showEin?: boolean;
}) {
  return (
    <div className="not-prose my-6 flex items-start gap-4 rounded-lg border p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/40">
        <Mail aria-hidden className="size-4 text-foreground/80" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium text-foreground">{heading}</p>
        <p className="mt-1 text-muted-foreground">{COMPANY_INFO_DEFAULTS.address}</p>
        {showEin ? <p className="text-muted-foreground">{COMPANY_INFO_DEFAULTS.taxId.replace(/^EIN /, "EIN: ")}</p> : null}
        <div className="mt-2 flex flex-wrap gap-x-4">
          {emails.map((email) => (
            <a
              key={email}
              href={`mailto:${email}`}
              className="inline-flex min-h-11 items-center font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {email}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
