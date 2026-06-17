import { db } from "@/lib/db";
import {
  type PaginationParams,
  paginationMeta,
} from "@/lib/utils/pagination";
import type { BlogPostStatus } from "@prisma/client";

interface GetPostsParams extends PaginationParams {
  status?: BlogPostStatus;
  categoryId?: string;
}

export async function getPosts(params: GetPostsParams) {
  const { page, perPage, search, sortBy, sortOrder, status, categoryId } =
    params;

  const where = {
    ...(status && { status }),
    ...(categoryId && { categoryId }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { excerpt: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    db.blogPost.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { [sortBy || "createdAt"]: sortOrder || "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.blogPost.count({ where }),
  ]);

  return { data, ...paginationMeta(total, params) };
}

export async function getPostBySlug(slug: string) {
  return db.blogPost.findUnique({
    where: { slug },
    include: {
      category: true,
    },
  });
}

export async function getPostById(id: string) {
  return db.blogPost.findUnique({
    where: { id },
    include: {
      category: true,
    },
  });
}

export async function getBlogCategories() {
  return db.blogCategory.findMany({
    include: {
      _count: {
        select: { posts: { where: { status: "PUBLISHED" } } },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getRecentPublishedPosts(excludeSlug?: string, take = 3) {
  return db.blogPost.findMany({
    where: {
      status: "PUBLISHED",
      ...(excludeSlug && { slug: { not: excludeSlug } }),
    },
    include: { category: true },
    orderBy: { publishedAt: "desc" },
    take,
  });
}

export async function getPublishedPosts(params: PaginationParams) {
  const { page, perPage, search, sortBy, sortOrder } = params;

  const where = {
    status: "PUBLISHED" as const,
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { excerpt: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    db.blogPost.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { [sortBy || "publishedAt"]: sortOrder || "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.blogPost.count({ where }),
  ]);

  return { data, ...paginationMeta(total, params) };
}
