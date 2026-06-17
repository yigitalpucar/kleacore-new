import { getCategories } from "@/lib/dal/knowledge-base";
import { NewKbArticleContent } from "./content";

export const dynamic = "force-dynamic";

export default async function NewKbArticlePage() {
  const categories = await getCategories();
  return <NewKbArticleContent categories={categories} />;
}