import { z } from "zod";

const slugSchema = z
  .string()
  .min(2, "Slug en az 2 karakter olmalı")
  .regex(/^[a-z0-9-]+$/, "Slug yalnızca küçük harf, rakam ve tire içerebilir");

export const blogCategorySchema = z.object({
  name: z.string().min(2, "Kategori adı en az 2 karakter olmalı"),
  slug: slugSchema,
  description: z.string().optional(),
});

export const blogPostSchema = z.object({
  categoryId: z.string().min(1, "Kategori seçiniz"),
  title: z.string().min(2, "Başlık en az 2 karakter olmalı"),
  slug: slugSchema,
  excerpt: z.string().optional(),
  content: z.string().optional(),
  coverImage: z.string().optional().nullable(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
});

export const kbCategorySchema = z.object({
  name: z.string().min(2, "Kategori adı en az 2 karakter olmalı"),
  slug: slugSchema,
  description: z.string().optional(),
  icon: z.string().optional(),
  displayOrder: z.number().optional(),
});

export const kbArticleSchema = z.object({
  categoryId: z.string().min(1, "Kategori seçiniz"),
  title: z.string().min(2, "Başlık en az 2 karakter olmalı"),
  slug: slugSchema,
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  displayOrder: z.number().optional(),
});