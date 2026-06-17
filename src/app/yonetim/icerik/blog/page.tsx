import { getPosts, getBlogCategories } from "@/lib/dal/blog";
import { parsePagination } from "@/lib/utils/pagination";
import { BlogContent } from "./content";
import type { BlogPostStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function BlogAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);

  const status = sp.durum
    ? ((sp.durum as string).toUpperCase() as BlogPostStatus)
    : undefined;
  const categoryId = sp.kategori as string | undefined;

  const [result, categories] = await Promise.all([
    getPosts({
      ...params,
      perPage: 50,
      status,
      categoryId,
    }),
    getBlogCategories(),
  ]);

  return (
    <BlogContent
      data={result.data}
      total={result.total}
      categories={categories}
      initialCategory={categoryId || "all"}
    />
  );
}