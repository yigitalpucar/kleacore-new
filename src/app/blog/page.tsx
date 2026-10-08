import type { Metadata } from "next";
import { getBlogCategories, getPosts, getPublishedPosts } from "@/lib/dal/blog";
import { parsePagination } from "@/lib/utils/pagination";
import { BlogContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Alan adı, web hosting, SSL, sunucu ve e-posta üzerine Türkçe rehberler. Doğru paketi seçmek ve sitenizi güvenle yönetmek için ipuçları.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog | KLEACORE",
    description: "Alan adı, hosting, SSL ve sunucu üzerine Türkçe rehberler ve ipuçları.",
    url: "/blog",
  },
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);
  const categorySlug = typeof sp.kategori === "string" ? sp.kategori : "";

  const categories = await getBlogCategories();
  const activeCategory = categories.find((cat) => cat.slug === categorySlug) ?? null;

  // Category filter uses the existing DAL (published posts in that category).
  const result = activeCategory
    ? await getPosts({
        ...params,
        status: "PUBLISHED",
        categoryId: activeCategory.id,
        sortBy: params.sortBy || "publishedAt",
      })
    : await getPublishedPosts(params);

  const serializedPosts = result.data.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    coverImage: post.coverImage,
    author: post.author,
    tags: post.tags as string[],
    viewCount: post.viewCount,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    category: post.category
      ? { id: post.category.id, name: post.category.name, slug: post.category.slug }
      : null,
  }));

  const serializedCategories = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    postCount: cat._count.posts,
  }));

  return (
    <BlogContent
      posts={serializedPosts}
      categories={serializedCategories}
      activeCategory={activeCategory?.slug ?? ""}
      page={result.page}
      totalPages={result.totalPages}
      total={result.total}
      search={params.search ?? ""}
    />
  );
}
