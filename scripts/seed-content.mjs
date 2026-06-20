#!/usr/bin/env node
/**
 * Idempotent SEO content seed — blog posts + knowledge base articles.
 *
 * Usage:
 *   node scripts/seed-content.mjs
 *   npm run db:seed:content
 *
 * Requires DATABASE_URL in .env (or environment).
 * Skips any article whose slug already exists in blog_posts or kb_articles.
 */
import "dotenv/config";
import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  blogCategories,
  kbCategories,
  seoArticles,
} from "./seed-data/seo-articles.mjs";

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const now = new Date();

async function ensureBlogCategories() {
  const map = new Map();
  for (const cat of blogCategories) {
    const row = await prisma.blogCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
      },
      create: {
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
      },
    });
    map.set(cat.slug, row.id);
  }
  return map;
}

async function ensureKbCategories() {
  const map = new Map();
  for (const cat of kbCategories) {
    const row = await prisma.knowledgeBaseCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        displayOrder: cat.displayOrder,
      },
      create: {
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        displayOrder: cat.displayOrder,
      },
    });
    map.set(cat.slug, row.id);
  }
  return map;
}

async function seedBlogPosts(categoryIds) {
  const created = [];
  const skipped = [];

  for (const article of seoArticles) {
    const existing = await prisma.blogPost.findUnique({
      where: { slug: article.slug },
      select: { slug: true },
    });

    if (existing) {
      skipped.push(article.slug);
      console.log(`  [blog] skip (exists): ${article.slug}`);
      continue;
    }

    const categoryId = categoryIds.get(article.categorySlug);
    if (!categoryId) {
      throw new Error(`Blog category not found: ${article.categorySlug}`);
    }

    await prisma.blogPost.create({
      data: {
        categoryId,
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        content: article.content,
        author: "KLEACORE",
        tags: article.tags,
        status: "PUBLISHED",
        publishedAt: now,
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
      },
    });

    created.push(article.slug);
    console.log(`  [blog] created: ${article.slug}`);
  }

  return { created, skipped };
}

async function seedKbArticles(categoryIds) {
  const created = [];
  const skipped = [];

  for (const article of seoArticles) {
    const existing = await prisma.knowledgeBaseArticle.findUnique({
      where: { slug: article.slug },
      select: { slug: true },
    });

    if (existing) {
      skipped.push(article.slug);
      console.log(`  [kb]   skip (exists): ${article.slug}`);
      continue;
    }

    const categoryId = categoryIds.get(article.kbCategorySlug);
    if (!categoryId) {
      throw new Error(`KB category not found: ${article.kbCategorySlug}`);
    }

    await prisma.knowledgeBaseArticle.create({
      data: {
        categoryId,
        title: article.title,
        slug: article.slug,
        content: article.content,
        tags: article.tags,
        status: "PUBLISHED",
        publishedAt: now,
        displayOrder: article.displayOrder ?? 0,
      },
    });

    created.push(article.slug);
    console.log(`  [kb]   created: ${article.slug}`);
  }

  return { created, skipped };
}

async function main() {
  console.log("KLEACORE SEO content seed (idempotent)\n");

  console.log("Ensuring blog categories...");
  const blogCategoryIds = await ensureBlogCategories();
  console.log(`  ${blogCategories.length} blog categories ready.\n`);

  console.log("Ensuring knowledge base categories...");
  const kbCategoryIds = await ensureKbCategories();
  console.log(`  ${kbCategories.length} KB categories ready.\n`);

  console.log("Seeding blog posts...");
  const blog = await seedBlogPosts(blogCategoryIds);
  console.log(`  Blog: ${blog.created.length} created, ${blog.skipped.length} skipped.\n`);

  console.log("Seeding knowledge base articles...");
  const kb = await seedKbArticles(kbCategoryIds);
  console.log(`  KB:   ${kb.created.length} created, ${kb.skipped.length} skipped.\n`);

  console.log("--- Summary ---");
  console.log(`Blog posts created (${blog.created.length}):`);
  for (const slug of blog.created) console.log(`  - ${slug}`);
  if (blog.skipped.length) {
    console.log(`Blog posts skipped (${blog.skipped.length}):`);
    for (const slug of blog.skipped) console.log(`  - ${slug}`);
  }

  console.log(`\nKB articles created (${kb.created.length}):`);
  for (const slug of kb.created) console.log(`  - ${slug}`);
  if (kb.skipped.length) {
    console.log(`KB articles skipped (${kb.skipped.length}):`);
    for (const slug of kb.skipped) console.log(`  - ${slug}`);
  }

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });