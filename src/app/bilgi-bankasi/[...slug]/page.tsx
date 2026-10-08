import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug, getArticleBySlug } from "@/lib/dal/knowledge-base";
import { CategoryContent, ArticleContent } from "./content";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

function plainExcerpt(content: string, length = 160) {
  const text = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#+\s.*$/gm, " ")
    .replace(/[#*`>|_]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  if (slug.length === 1) {
    const category = await getCategoryBySlug(slug[0]);
    if (!category) return { title: "Kategori Bulunamadı", robots: { index: false } };
    const path = `/bilgi-bankasi/${category.slug}`;
    return {
      title: `${category.name} - Bilgi Bankası`,
      description: `${category.description}. KLEACORE bilgi bankasında ${category.name} rehberleri.`.slice(0, 160),
      alternates: { canonical: path },
      openGraph: { title: `${category.name} - Bilgi Bankası | KLEACORE`, description: category.description, url: path },
    };
  }

  if (slug.length === 2) {
    const article = await getArticleBySlug(slug[1]);
    if (!article || article.category.slug !== slug[0]) {
      return { title: "Makale Bulunamadı", robots: { index: false } };
    }
    const path = `/bilgi-bankasi/${article.category.slug}/${article.slug}`;
    const description = plainExcerpt(article.content);
    return {
      title: `${article.title} - Bilgi Bankası`,
      description,
      alternates: { canonical: path },
      openGraph: {
        type: "article",
        title: `${article.title} | KLEACORE`,
        description,
        url: path,
        modifiedTime: article.updatedAt.toISOString(),
      },
    };
  }

  return { title: "Bilgi Bankası" };
}

export default async function BilgiBankasiSlugPage({ params }: PageProps) {
  const { slug } = await params;

  // 1 segment -> category page
  if (slug.length === 1) {
    const category = await getCategoryBySlug(slug[0]);
    if (!category) notFound();

    const serializedCategory = {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      icon: category.icon,
      articleCount: category._count.articles,
    };

    const serializedArticles = category.articles.map((article) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: plainExcerpt(article.content, 140),
      categorySlug: category.slug,
    }));

    return (
      <CategoryContent
        category={serializedCategory}
        articles={serializedArticles}
      />
    );
  }

  // 2 segments -> article page
  if (slug.length === 2) {
    const [categorySlug, articleSlug] = slug;
    const article = await getArticleBySlug(articleSlug);

    if (!article || article.category.slug !== categorySlug) notFound();

    const serializedArticle = {
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      tags: article.tags as string[],
      viewCount: article.viewCount,
      helpfulCount: article.helpfulCount,
      notHelpfulCount: article.notHelpfulCount,
      publishedAt: article.publishedAt?.toISOString() ?? null,
      updatedAt: article.updatedAt.toISOString(),
      category: {
        name: article.category.name,
        slug: article.category.slug,
        icon: article.category.icon,
      },
    };

    return <ArticleContent article={serializedArticle} />;
  }

  // 3+ segments -> not found
  notFound();
}
