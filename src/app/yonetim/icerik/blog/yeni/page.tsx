import { getBlogCategories } from "@/lib/dal/blog";
import { NewBlogPostContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export default async function NewBlogPostPage() {
  await requirePermission("content.manage");
  const categories = await getBlogCategories();
  return <NewBlogPostContent categories={categories} />;
}