import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getCategories, getPopularArticles } from "@/lib/dal/knowledge-base";
import { DestekContent } from "./content";

export default async function DestekPage() {
  const [categories, popularArticles] = await Promise.all([
    getCategories(),
    getPopularArticles(6),
  ]);

  const serializedCategories = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    icon: cat.icon,
    _count: cat._count,
  }));

  const serializedArticles = popularArticles.map((article) => ({
    id: article.id,
    title: article.title,
    slug: article.slug,
    viewCount: article.viewCount,
    category: article.category
      ? { name: article.category.name, slug: article.category.slug }
      : null,
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1">
        <DestekContent
          categories={serializedCategories}
          popularArticles={serializedArticles}
        />
      </main>
      <Footer />
    </div>
  );
}
