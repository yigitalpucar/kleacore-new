import type { Metadata } from "next";
import { getCategories, getPopularArticles, getRecentArticles } from "@/lib/dal/knowledge-base";
import { BilgiBankasiContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bilgi Bankası",
  description:
    "Hosting, alan adı, DNS, SSL, sunucu ve e-posta hakkında adım adım rehberler ve çözümler. KLEACORE bilgi bankasında aradığınızı bulun.",
  alternates: { canonical: "/bilgi-bankasi" },
  openGraph: {
    title: "Bilgi Bankası | KLEACORE",
    description: "Hosting, alan adı, SSL ve daha fazlası hakkında detaylı rehberler ve çözümler.",
    url: "/bilgi-bankasi",
  },
};

export default async function BilgiBankasiPage() {
  const [categories, popularArticles, recentArticles] = await Promise.all([
    getCategories(),
    getPopularArticles(8),
    getRecentArticles(5),
  ]);

  const serializedCategories = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    icon: cat.icon,
    // Published articles only (the DAL already filters `articles`).
    articleCount: cat.articles.length,
  }));

  // All published article titles, for in-page search.
  const searchIndex = categories.flatMap((cat) =>
    cat.articles.map((article) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      tags: (article.tags as string[]) ?? [],
      categoryName: cat.name,
      categorySlug: cat.slug,
    }))
  );

  const serializedPopularArticles = popularArticles.map((article) => ({
    id: article.id,
    title: article.title,
    slug: article.slug,
    categoryName: article.category.name,
    categorySlug: article.category.slug,
  }));

  const serializedRecentArticles = recentArticles.map((article) => ({
    id: article.id,
    title: article.title,
    slug: article.slug,
    categoryName: article.category.name,
    categorySlug: article.category.slug,
    publishedAt: article.publishedAt?.toISOString() ?? null,
  }));

  return (
    <BilgiBankasiContent
      categories={serializedCategories}
      searchIndex={searchIndex}
      popularArticles={serializedPopularArticles}
      recentArticles={serializedRecentArticles}
    />
  );
}
