"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { kbArticleSchema, kbCategorySchema } from "@/lib/validations/content";
import { revalidatePath } from "next/cache";
import type { KbArticleStatus, Prisma } from "@prisma/client";

interface KbCategoryInput {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  displayOrder?: number;
}

interface KbArticleInput {
  categoryId: string;
  title: string;
  slug: string;
  content?: string;
  tags?: string[];
  status?: KbArticleStatus;
  displayOrder?: number;
}

function revalidateKbPaths() {
  revalidatePath("/yonetim/icerik/bilgi-bankasi");
  revalidatePath("/bilgi-bankasi");
}

export async function createKbCategory(data: KbCategoryInput) {
  await requireAdmin();

  try {
    const parsed = kbCategorySchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Geçersiz kategori bilgileri",
      };
    }

    const existing = await db.knowledgeBaseCategory.findUnique({
      where: { slug: data.slug },
    });
    if (existing) {
      return { success: false, error: "Bu slug zaten kullanılıyor" };
    }

    const category = await db.knowledgeBaseCategory.create({
      data: {
        name: data.name.trim(),
        slug: data.slug.trim(),
        description: data.description ?? "",
        icon: data.icon ?? "Book",
        displayOrder: data.displayOrder ?? 0,
      },
    });

    revalidateKbPaths();
    return { success: true, data: { id: category.id } };
  } catch {
    return { success: false, error: "Kategori oluşturulurken bir hata oluştu" };
  }
}

export async function updateKbCategory(id: string, data: Partial<KbCategoryInput>) {
  await requireAdmin();

  try {
    const category = await db.knowledgeBaseCategory.findUnique({ where: { id } });
    if (!category) {
      return { success: false, error: "Kategori bulunamadı" };
    }

    if (data.slug && data.slug !== category.slug) {
      const existing = await db.knowledgeBaseCategory.findUnique({
        where: { slug: data.slug },
      });
      if (existing) {
        return { success: false, error: "Bu slug zaten kullanılıyor" };
      }
    }

    await db.knowledgeBaseCategory.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.slug !== undefined && { slug: data.slug.trim() }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
      },
    });

    revalidateKbPaths();
    return { success: true };
  } catch {
    return { success: false, error: "Kategori güncellenirken bir hata oluştu" };
  }
}

export async function deleteKbCategory(id: string) {
  await requireAdmin();

  try {
    const category = await db.knowledgeBaseCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { articles: true } },
      },
    });

    if (!category) {
      return { success: false, error: "Kategori bulunamadı" };
    }

    if (category._count.articles > 0) {
      return {
        success: false,
        error: "Bu kategoride makale bulunduğu için silinemez",
      };
    }

    await db.knowledgeBaseCategory.delete({ where: { id } });
    revalidateKbPaths();
    return { success: true };
  } catch {
    return { success: false, error: "Kategori silinirken bir hata oluştu" };
  }
}

export async function createKbArticle(data: KbArticleInput) {
  await requireAdmin();

  try {
    const parsed = kbArticleSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Geçersiz makale bilgileri",
      };
    }

    const category = await db.knowledgeBaseCategory.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      return { success: false, error: "Geçersiz kategori" };
    }

    const existing = await db.knowledgeBaseArticle.findUnique({
      where: { slug: data.slug },
    });
    if (existing) {
      return { success: false, error: "Bu slug zaten kullanılıyor" };
    }

    const status = data.status ?? "DRAFT";
    const article = await db.knowledgeBaseArticle.create({
      data: {
        categoryId: data.categoryId,
        title: data.title.trim(),
        slug: data.slug.trim(),
        content: data.content ?? "",
        tags: data.tags ?? [],
        status,
        displayOrder: data.displayOrder ?? 0,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
      },
    });

    revalidateKbPaths();
    return { success: true, data: { id: article.id } };
  } catch {
    return { success: false, error: "Makale oluşturulurken bir hata oluştu" };
  }
}

export async function updateKbArticle(id: string, data: Partial<KbArticleInput>) {
  await requireAdmin();

  try {
    const article = await db.knowledgeBaseArticle.findUnique({ where: { id } });
    if (!article) {
      return { success: false, error: "Makale bulunamadı" };
    }

    if (data.slug && data.slug !== article.slug) {
      const existing = await db.knowledgeBaseArticle.findUnique({
        where: { slug: data.slug },
      });
      if (existing) {
        return { success: false, error: "Bu slug zaten kullanılıyor" };
      }
    }

    if (data.categoryId) {
      const category = await db.knowledgeBaseCategory.findUnique({
        where: { id: data.categoryId },
      });
      if (!category) {
        return { success: false, error: "Geçersiz kategori" };
      }
    }

    const updateData: Prisma.KnowledgeBaseArticleUpdateInput = {};

    if (data.categoryId) {
      updateData.category = { connect: { id: data.categoryId } };
    }
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.slug !== undefined) updateData.slug = data.slug.trim();
    if (data.content !== undefined) updateData.content = data.content;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === "PUBLISHED" && !article.publishedAt) {
        updateData.publishedAt = new Date();
      }
      if (data.status === "DRAFT") {
        updateData.publishedAt = null;
      }
    }

    await db.knowledgeBaseArticle.update({
      where: { id },
      data: updateData,
    });

    revalidateKbPaths();
    return { success: true };
  } catch {
    return { success: false, error: "Makale güncellenirken bir hata oluştu" };
  }
}

export async function publishKbArticle(id: string) {
  await requireAdmin();

  try {
    const article = await db.knowledgeBaseArticle.findUnique({ where: { id } });
    if (!article) {
      return { success: false, error: "Makale bulunamadı" };
    }

    await db.knowledgeBaseArticle.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: article.publishedAt ?? new Date(),
      },
    });

    revalidateKbPaths();
    return { success: true };
  } catch {
    return { success: false, error: "Makale yayınlanırken bir hata oluştu" };
  }
}

export async function archiveKbArticle(id: string) {
  await requireAdmin();

  try {
    const article = await db.knowledgeBaseArticle.findUnique({ where: { id } });
    if (!article) {
      return { success: false, error: "Makale bulunamadı" };
    }

    await db.knowledgeBaseArticle.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    revalidateKbPaths();
    return { success: true };
  } catch {
    return { success: false, error: "Makale arşivlenirken bir hata oluştu" };
  }
}

export async function deleteKbArticle(id: string) {
  await requireAdmin();

  try {
    const article = await db.knowledgeBaseArticle.findUnique({ where: { id } });
    if (!article) {
      return { success: false, error: "Makale bulunamadı" };
    }

    await db.knowledgeBaseArticle.delete({ where: { id } });
    revalidateKbPaths();
    return { success: true };
  } catch {
    return { success: false, error: "Makale silinirken bir hata oluştu" };
  }
}