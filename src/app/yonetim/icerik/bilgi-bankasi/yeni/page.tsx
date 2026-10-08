import { getCategories } from "@/lib/dal/knowledge-base";
import { NewKbArticleContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export default async function NewKbArticlePage() {
  await requirePermission("content.manage");
  const categories = await getCategories();
  return <NewKbArticleContent categories={categories} />;
}