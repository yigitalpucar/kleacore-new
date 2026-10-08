"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { blogCategorySchema, blogPostSchema } from "@/lib/validations/content";
import { revalidatePath } from "next/cache";
import type { BlogPostStatus, Prisma } from "@prisma/client";

interface BlogCategoryInput {
  name: string;
  slug: string;
  description?: string;
}

interface BlogPostInput {
  categoryId: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  coverImage?: string | null;
  author?: string;
  tags?: string[];
  status?: BlogPostStatus;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

function revalidateBlogPaths() {
  revalidatePath("/yonetim/icerik/blog");
  revalidatePath("/blog");
}

export async function createBlogCategory(data: BlogCategoryInput) {
  await requirePermission("content.manage");

  try {
    const parsed = blogCategorySchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Geçersiz kategori bilgileri",
      };
    }

    const existing = await db.blogCategory.findUnique({
      where: { slug: data.slug },
    });
    if (existing) {
      return { success: false, error: "Bu slug zaten kullanılıyor" };
    }

    const category = await db.blogCategory.create({
      data: {
        name: data.name.trim(),
        slug: data.slug.trim(),
        description: data.description ?? "",
      },
    });

    revalidateBlogPaths();
    return { success: true, data: { id: category.id } };
  } catch {
    return { success: false, error: "Kategori oluşturulurken bir hata oluştu" };
  }
}

export async function updateBlogCategory(id: string, data: Partial<BlogCategoryInput>) {
  await requirePermission("content.manage");

  try {
    const category = await db.blogCategory.findUnique({ where: { id } });
    if (!category) {
      return { success: false, error: "Kategori bulunamadı" };
    }

    if (data.slug && data.slug !== category.slug) {
      const existing = await db.blogCategory.findUnique({
        where: { slug: data.slug },
      });
      if (existing) {
        return { success: false, error: "Bu slug zaten kullanılıyor" };
      }
    }

    await db.blogCategory.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.slug !== undefined && { slug: data.slug.trim() }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });

    revalidateBlogPaths();
    return { success: true };
  } catch {
    return { success: false, error: "Kategori güncellenirken bir hata oluştu" };
  }
}

export async function deleteBlogCategory(id: string) {
  await requirePermission("content.manage");

  try {
    const category = await db.blogCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { posts: true } },
      },
    });

    if (!category) {
      return { success: false, error: "Kategori bulunamadı" };
    }

    if (category._count.posts > 0) {
      return {
        success: false,
        error: "Bu kategoride yazı bulunduğu için silinemez",
      };
    }

    await db.blogCategory.delete({ where: { id } });
    revalidateBlogPaths();
    return { success: true };
  } catch {
    return { success: false, error: "Kategori silinirken bir hata oluştu" };
  }
}

export async function createBlogPost(data: BlogPostInput) {
  await requirePermission("content.manage");

  try {
    const parsed = blogPostSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Geçersiz yazı bilgileri",
      };
    }

    const category = await db.blogCategory.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      return { success: false, error: "Geçersiz kategori" };
    }

    const existing = await db.blogPost.findUnique({
      where: { slug: data.slug },
    });
    if (existing) {
      return { success: false, error: "Bu slug zaten kullanılıyor" };
    }

    const status = data.status ?? "DRAFT";
    const post = await db.blogPost.create({
      data: {
        categoryId: data.categoryId,
        title: data.title.trim(),
        slug: data.slug.trim(),
        excerpt: data.excerpt ?? "",
        content: data.content ?? "",
        coverImage: data.coverImage ?? null,
        author: data.author ?? "KLEACORE",
        tags: data.tags ?? [],
        status,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        metaTitle: data.metaTitle ?? null,
        metaDescription: data.metaDescription ?? null,
      },
    });

    revalidateBlogPaths();
    return { success: true, data: { id: post.id } };
  } catch {
    return { success: false, error: "Yazı oluşturulurken bir hata oluştu" };
  }
}

export async function updateBlogPost(id: string, data: Partial<BlogPostInput>) {
  await requirePermission("content.manage");

  try {
    const post = await db.blogPost.findUnique({ where: { id } });
    if (!post) {
      return { success: false, error: "Yazı bulunamadı" };
    }

    if (data.slug && data.slug !== post.slug) {
      const existing = await db.blogPost.findUnique({
        where: { slug: data.slug },
      });
      if (existing) {
        return { success: false, error: "Bu slug zaten kullanılıyor" };
      }
    }

    if (data.categoryId) {
      const category = await db.blogCategory.findUnique({
        where: { id: data.categoryId },
      });
      if (!category) {
        return { success: false, error: "Geçersiz kategori" };
      }
    }

    const updateData: Prisma.BlogPostUpdateInput = {};

    if (data.categoryId) {
      updateData.category = { connect: { id: data.categoryId } };
    }
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.slug !== undefined) updateData.slug = data.slug.trim();
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.coverImage !== undefined) updateData.coverImage = data.coverImage;
    if (data.author !== undefined) updateData.author = data.author;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.metaTitle !== undefined) updateData.metaTitle = data.metaTitle;
    if (data.metaDescription !== undefined) {
      updateData.metaDescription = data.metaDescription;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === "PUBLISHED" && !post.publishedAt) {
        updateData.publishedAt = new Date();
      }
      if (data.status === "DRAFT") {
        updateData.publishedAt = null;
      }
    }

    await db.blogPost.update({
      where: { id },
      data: updateData,
    });

    revalidateBlogPaths();
    return { success: true };
  } catch {
    return { success: false, error: "Yazı güncellenirken bir hata oluştu" };
  }
}

export async function publishBlogPost(id: string) {
  await requirePermission("content.manage");

  try {
    const post = await db.blogPost.findUnique({ where: { id } });
    if (!post) {
      return { success: false, error: "Yazı bulunamadı" };
    }

    await db.blogPost.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: post.publishedAt ?? new Date(),
      },
    });

    revalidateBlogPaths();
    return { success: true };
  } catch {
    return { success: false, error: "Yazı yayınlanırken bir hata oluştu" };
  }
}

export async function archiveBlogPost(id: string) {
  await requirePermission("content.manage");

  try {
    const post = await db.blogPost.findUnique({ where: { id } });
    if (!post) {
      return { success: false, error: "Yazı bulunamadı" };
    }

    await db.blogPost.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    revalidateBlogPaths();
    return { success: true };
  } catch {
    return { success: false, error: "Yazı arşivlenirken bir hata oluştu" };
  }
}

export async function deleteBlogPost(id: string) {
  await requirePermission("content.manage");

  try {
    const post = await db.blogPost.findUnique({ where: { id } });
    if (!post) {
      return { success: false, error: "Yazı bulunamadı" };
    }

    await db.blogPost.delete({ where: { id } });
    revalidateBlogPaths();
    return { success: true };
  } catch {
    return { success: false, error: "Yazı silinirken bir hata oluştu" };
  }
}