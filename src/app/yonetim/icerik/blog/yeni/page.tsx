import { getBlogCategories } from "@/lib/dal/blog";
import { NewBlogPostContent } from "./content";

export const dynamic = "force-dynamic";

export default async function NewBlogPostPage() {
  const categories = await getBlogCategories();
  return <NewBlogPostContent categories={categories} />;
}