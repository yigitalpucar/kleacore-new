import { db } from "@/lib/db";
import {
  type PaginationParams,
  paginationMeta,
} from "@/lib/utils/pagination";
import type { KbArticleStatus } from "@prisma/client";

interface GetArticlesParams extends PaginationParams {
  status?: KbArticleStatus;
  categoryId?: string;
}

export async function getArticles(params: GetArticlesParams) {
  const { page, perPage, search, sortBy, sortOrder, status, categoryId } =
    params;

  const where = {
    ...(status && { status }),
    ...(categoryId && { categoryId }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { content: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    db.knowledgeBaseArticle.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { [sortBy || "displayOrder"]: sortOrder || "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.knowledgeBaseArticle.count({ where }),
  ]);

  return { data, ...paginationMeta(total, params) };
}

export async function getArticleBySlug(slug: string) {
  return db.knowledgeBaseArticle.findUnique({
    where: { slug },
    include: {
      category: true,
    },
  });
}

export async function getCategories() {
  return db.knowledgeBaseCategory.findMany({
    include: {
      articles: {
        where: { status: "PUBLISHED" },
        orderBy: { displayOrder: "asc" },
      },
      _count: {
        select: { articles: true },
      },
    },
    orderBy: { displayOrder: "asc" },
  });
}

export async function getCategoryBySlug(slug: string) {
  return db.knowledgeBaseCategory.findUnique({
    where: { slug },
    include: {
      articles: {
        where: { status: "PUBLISHED" },
        orderBy: { displayOrder: "asc" },
        include: { category: true },
      },
      _count: {
        select: { articles: true },
      },
    },
  });
}

export async function getPopularArticles(limit = 8) {
  return db.knowledgeBaseArticle.findMany({
    where: { status: "PUBLISHED" },
    include: { category: true },
    orderBy: { viewCount: "desc" },
    take: limit,
  });
}

export async function getRecentArticles(limit = 5) {
  return db.knowledgeBaseArticle.findMany({
    where: { status: "PUBLISHED" },
    include: { category: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}
