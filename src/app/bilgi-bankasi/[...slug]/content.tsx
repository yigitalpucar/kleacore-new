import { createElement } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FileText, LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { CtaBand } from "@/components/site/cta-band";
import { buttonClasses } from "@/components/site/button-classes";
import { SiteShell } from "@/components/site/kurumsal/site-shell";
import {
  ArticleLayout,
  ArticleMeta,
  TagList,
} from "@/components/site/kurumsal/article-layout";
import { MarkdownBlocks, parseMarkdown, readingMinutes } from "@/components/site/kurumsal/markdown";
import { kbIcon } from "../kb-icons";

interface SerializedCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  articleCount: number;
}

interface SerializedCategoryArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  categorySlug: string;
}

interface SerializedArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  tags: string[];
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  publishedAt: string | null;
  updatedAt: string;
  category: { name: string; slug: string; icon: string };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* ---------- Category ---------- */

export function CategoryContent({
  category,
  articles,
}: {
  category: SerializedCategory;
  articles: SerializedCategoryArticle[];
}) {
  return (
    <SiteShell>
      <PageHeader
        align="left"
        eyebrow={
          <span className="inline-flex items-center gap-2">
            {createElement(kbIcon(category.icon), { "aria-hidden": true, className: "size-3.5" })}
            {articles.length} makale
          </span>
        }
        title={category.name}
        description={category.description}
        breadcrumbs={[{ label: "Bilgi Bankası", href: "/bilgi-bankasi" }, { label: category.name }]}
      />

      <Section aria-labelledby="makaleler">
        <h2 id="makaleler" className="sr-only">
          {category.name} makaleleri
        </h2>
        {articles.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center sm:p-14">
            <p className="text-muted-foreground">Bu kategoride henüz makale bulunmuyor.</p>
            <Link href="/bilgi-bankasi" className={buttonClasses({ variant: "outline", className: "mt-6" })}>
              Tüm kategoriler
            </Link>
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border">
            {articles.map((article, index) => (
              <li key={article.id}>
                <Link
                  href={`/bilgi-bankasi/${article.categorySlug}/${article.slug}`}
                  className="group flex items-start gap-4 p-5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-6"
                >
                  <span className="mt-0.5 hidden font-mono text-[11px] tracking-[0.1em] text-muted-foreground sm:block">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <FileText aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground sm:hidden" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-medium tracking-tight">{article.title}</span>
                    <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-muted-foreground">
                      {article.content}
                    </span>
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <CtaBand
        eyebrow="Destek"
        title="Aradığınızı bulamadınız mı?"
        description="Destek merkezinden talep oluşturun veya bize yazın; ekibimiz yardımcı olsun."
        primary={{ label: "Destek merkezi", href: "/musteri/destek" }}
        secondary={{ label: "Tüm kategoriler", href: "/bilgi-bankasi" }}
      />
    </SiteShell>
  );
}

/* ---------- Article ---------- */

export function ArticleContent({ article }: { article: SerializedArticle }) {
  const { blocks, toc } = parseMarkdown(article.content);
  const categoryHref = `/bilgi-bankasi/${article.category.slug}`;

  return (
    <ArticleLayout
      breadcrumbs={[
        { label: "Bilgi Bankası", href: "/bilgi-bankasi" },
        { label: article.category.name, href: categoryHref },
        { label: article.title },
      ]}
      eyebrow={
        <Link
          href={categoryHref}
          className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {article.category.name}
        </Link>
      }
      title={article.title}
      meta={
        <ArticleMeta
          items={[
            `${readingMinutes(article.content)} dk okuma`,
            <>
              Güncelleme: <time dateTime={article.updatedAt}>{formatDate(article.updatedAt)}</time>
            </>,
          ]}
        />
      }
      toc={toc}
      sidebar={
        <div className="rounded-lg border bg-muted/30 p-5">
          <p className="text-sm font-medium">Yardıma mı ihtiyacınız var?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Teknik ekibimiz size yardımcı olmaya hazır.
          </p>
          <Link
            href="/musteri/panel/destek/yeni"
            className={buttonClasses({ size: "md", className: "mt-4 w-full" })}
          >
            <LifeBuoy aria-hidden className="size-4" />
            Destek talebi oluştur
          </Link>
        </div>
      }
      footer={
        <>
          <TagList tags={article.tags} />
          <Link href={categoryHref} className={buttonClasses({ variant: "outline" })}>
            <ArrowLeft aria-hidden className="size-4" />
            {article.category.name} makaleleri
          </Link>
        </>
      }
    >
      <MarkdownBlocks blocks={blocks} />
    </ArticleLayout>
  );
}
