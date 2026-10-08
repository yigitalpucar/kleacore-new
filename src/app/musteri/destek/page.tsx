import type { Metadata } from "next";
import { getCategories, getPopularArticles } from "@/lib/dal/knowledge-base";
import { DestekContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Destek Merkezi",
  description:
    "KLEACORE destek merkezi: bilgi bankasında arayın, destek talebi oluşturun veya support@kleacore.com adresine yazın.",
  alternates: { canonical: "/musteri/destek" },
  openGraph: {
    title: "Destek Merkezi | KLEACORE",
    description: "Bilgi bankası, destek talebi ve e-posta ile KLEACORE desteğine ulaşın.",
    url: "/musteri/destek",
  },
};

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
    // Published articles only (the DAL already filters `articles`).
    articleCount: cat.articles.length,
  }));

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

  const serializedArticles = popularArticles.map((article) => ({
    id: article.id,
    title: article.title,
    slug: article.slug,
    categoryName: article.category.name,
    categorySlug: article.category.slug,
  }));

  return (
    <DestekContent
      categories={serializedCategories}
      searchIndex={searchIndex}
      popularArticles={serializedArticles}
    />
  );
}
