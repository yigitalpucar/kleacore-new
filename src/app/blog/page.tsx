import { getPublishedPosts, getBlogCategories } from "@/lib/dal/blog";
import { parsePagination } from "@/lib/utils/pagination";
import { BlogContent } from "./content";

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);

  const [result, categories] = await Promise.all([
    getPublishedPosts(params),
    getBlogCategories(),
  ]);

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
      page={result.page}
      totalPages={result.totalPages}
      total={result.total}
      search={params.search ?? ""}
    />
  );
}
