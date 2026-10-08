import { getPostBySlug, getRecentPublishedPosts } from "@/lib/dal/blog";
import { notFound } from "next/navigation";
import { BlogPostContent } from "./content";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post || post.status !== "PUBLISHED") {
    return { title: "Yazı Bulunamadı", robots: { index: false } };
  }

  const title = post.metaTitle || post.title;
  const description = (post.metaDescription || post.excerpt || undefined)?.slice(0, 160);
  const path = `/blog/${post.slug}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title: `${title} | KLEACORE`,
      description,
      url: path,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      tags: post.tags as string[],
      ...(post.coverImage ? { images: [post.coverImage] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post || post.status !== "PUBLISHED") return notFound();

  const recentPosts = await getRecentPublishedPosts(slug, 3);

  const serializedPost = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    coverImage: post.coverImage,
    author: post.author,
    tags: post.tags as string[],
    viewCount: post.viewCount,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    category: post.category
      ? { id: post.category.id, name: post.category.name, slug: post.category.slug }
      : null,
  };

  const serializedRecent = recentPosts.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    coverImage: p.coverImage,
    author: p.author,
    tags: [] as string[],
    viewCount: p.viewCount,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    category: p.category
      ? { id: p.category.id, name: p.category.name, slug: p.category.slug }
      : null,
  }));

  return <BlogPostContent post={serializedPost} recentPosts={serializedRecent} />;
}
