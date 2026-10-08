import { notFound } from "next/navigation";
import { getPostById, getBlogCategories } from "@/lib/dal/blog";
import { EditBlogPostContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("content.manage");
  const { id } = await params;
  const [post, categories] = await Promise.all([
    getPostById(id),
    getBlogCategories(),
  ]);

  if (!post) return notFound();

  return <EditBlogPostContent post={post} categories={categories} />;
}