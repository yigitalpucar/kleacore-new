import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug, getArticleBySlug } from "@/lib/dal/knowledge-base";
import { CategoryContent, ArticleContent } from "./content";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  if (slug.length === 1) {
    const category = await getCategoryBySlug(slug[0]);
    if (!category) return { title: "Kategori Bulunamadı" };
    return {
      title: `${category.name} - Bilgi Bankası`,
      description: category.description,
    };
  }

  if (slug.length === 2) {
    const article = await getArticleBySlug(slug[1]);
    if (!article) return { title: "Makale Bulunamadı" };
    return {
      title: `${article.title} - Bilgi Bankası`,
      description: article.content.substring(0, 160).replace(/[#*`\n]/g, ""),
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
      content: article.content.substring(0, 120).replace(/[#*`\n]/g, ""),
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
