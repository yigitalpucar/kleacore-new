import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { CtaBand } from "@/components/site/cta-band";
import { Eyebrow } from "@/components/site/eyebrow";
import { SiteShell } from "@/components/site/kurumsal/site-shell";
import {
  changelog,
  changelogCategoryLabels,
  type ChangelogEntry,
} from "@/content/changelog";

export const metadata: Metadata = {
  title: "Yenilikler - Değişiklik Günlüğü",
  description:
    "KLEACORE web sitesi ve müşteri panelindeki yeni özellikler, iyileştirmeler ve düzeltmeler tarih sırasıyla.",
  alternates: { canonical: "/degisiklikler" },
  openGraph: {
    title: "Yenilikler - Değişiklik Günlüğü | KLEACORE",
    description:
      "KLEACORE web sitesi ve müşteri panelindeki yeni özellikler, iyileştirmeler ve düzeltmeler.",
    url: "/degisiklikler",
  },
};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function entryId(entry: ChangelogEntry, index: number) {
  return `degisiklik-${entry.date}-${index}`;
}

function CategoryBadge({ category }: { category: ChangelogEntry["category"] }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-background px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-foreground">
      {changelogCategoryLabels[category]}
    </span>
  );
}

export default function DegisikliklerPage() {
  return (
    <SiteShell>
      <PageHeader
        eyebrow="Değişiklik günlüğü"
        title="Yenilikler"
        description="Web sitesi ve müşteri panelinde yaptığımız değişiklikleri burada yayımlıyoruz: yeni özellikler, iyileştirmeler ve düzeltmeler."
        breadcrumbs={[{ label: "Yenilikler" }]}
      />

      <Section aria-label="Değişiklik kayıtları" containerClassName="max-w-4xl">
        <ol className="relative">
          {/* Timeline rail (desktop: between date column and content). */}
          <span
            aria-hidden
            className="absolute bottom-0 left-[5px] top-2 w-px border-l border-dashed md:left-[200px]"
          />
          {changelog.map((entry, index) => {
            const id = entryId(entry, index);
            return (
              <li
                key={id}
                className="relative grid gap-3 pb-14 pl-8 last:pb-0 md:grid-cols-[176px_1fr] md:gap-12 md:pl-0"
                aria-labelledby={id}
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-background bg-foreground ring-1 ring-border md:left-[195px]"
                />
                <div className="flex flex-wrap items-center gap-3 md:sticky md:top-24 md:h-min md:flex-col md:items-end md:gap-2 md:text-right">
                  <time
                    dateTime={entry.date}
                    className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    {formatDate(entry.date)}
                  </time>
                  <CategoryBadge category={entry.category} />
                </div>
                <article className="min-w-0">
                  <h2
                    id={id}
                    className="text-balance text-xl font-semibold tracking-tight sm:text-2xl"
                  >
                    {entry.title}
                  </h2>
                  <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
                    {entry.summary}
                  </p>
                  {entry.items && entry.items.length > 0 ? (
                    <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {entry.items.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span
                            aria-hidden
                            className="mt-2.5 size-1.5 shrink-0 bg-foreground/60"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {entry.link ? (
                    <Link
                      href={entry.link.href}
                      className="group mt-5 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {entry.link.label}
                      <ArrowUpRight
                        aria-hidden
                        className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                      />
                    </Link>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      </Section>

      <CtaBand
        eyebrow="Geri bildirim"
        title="Bir öneriniz mi var?"
        description="Görmek istediğiniz bir özelliği veya karşılaştığınız bir sorunu bize iletin."
        primary={{ label: "Bize ulaşın", href: "/iletisim" }}
        secondary={{ label: "Sistem durumu", href: "/musteri/durum" }}
        aside={
          <div className="flex h-full flex-col justify-center gap-4 text-sm">
            <Eyebrow>E-posta</Eyebrow>
            <p className="leading-relaxed text-muted-foreground">Öneri ve hata bildirimlerinizi doğrudan e-postayla da iletebilirsiniz.</p>
            <a
              href="mailto:support@kleacore.com"
              className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              support@kleacore.com
            </a>
          </div>
        }
      />
    </SiteShell>
  );
}
