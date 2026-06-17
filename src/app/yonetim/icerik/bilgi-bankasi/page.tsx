import { getArticles, getCategories } from "@/lib/dal/knowledge-base";
import { parsePagination } from "@/lib/utils/pagination";
import { KnowledgeBaseContent } from "./content";
import type { KbArticleStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function KnowledgeBaseAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);

  const status = sp.durum
    ? ((sp.durum as string).toUpperCase() as KbArticleStatus)
    : undefined;
  const categoryId = sp.kategori as string | undefined;

  const [result, categories] = await Promise.all([
    getArticles({
      ...params,
      perPage: 50,
      status,
      categoryId,
    }),
    getCategories(),
  ]);

  return (
    <KnowledgeBaseContent
      data={result.data}
      total={result.total}
      categories={categories}
      initialCategory={categoryId || "all"}
    />
  );
}