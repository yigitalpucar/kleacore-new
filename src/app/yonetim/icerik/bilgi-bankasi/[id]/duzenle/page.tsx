import { notFound } from "next/navigation";
import { getArticleById, getCategories } from "@/lib/dal/knowledge-base";
import { EditKbArticleContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export default async function EditKbArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("content.manage");
  const { id } = await params;
  const [article, categories] = await Promise.all([
    getArticleById(id),
    getCategories(),
  ]);

  if (!article) return notFound();

  return <EditKbArticleContent article={article} categories={categories} />;
}