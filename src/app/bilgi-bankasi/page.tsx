import { getCategories, getPopularArticles, getRecentArticles } from "@/lib/dal/knowledge-base";
import { BilgiBankasiContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bilgi Bankası",
  description: "Hosting, domain, SSL ve daha fazlası hakkında detaylı rehberler ve çözümler.",
};

export default async function BilgiBankasiPage() {
  const [categories, popularArticles, recentArticles] = await Promise.all([
    getCategories(),
    getPopularArticles(8),
    getRecentArticles(5),
  ]);

  // Serialize dates for client component
  const serializedCategories = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    icon: cat.icon,
    displayOrder: cat.displayOrder,
    articleCount: cat._count.articles,
    createdAt: cat.createdAt.toISOString(),
    updatedAt: cat.updatedAt.toISOString(),
  }));

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
      popularArticles={serializedPopularArticles}
      recentArticles={serializedRecentArticles}
    />
  );
}
