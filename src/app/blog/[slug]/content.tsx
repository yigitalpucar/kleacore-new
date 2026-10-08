import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { buttonClasses } from "@/components/site/button-classes";
import {
  ArticleLayout,
  ArticleMeta,
  TagList,
} from "@/components/site/kurumsal/article-layout";
import { MarkdownBlocks, parseMarkdown, readingMinutes } from "@/components/site/kurumsal/markdown";
import { ShareLinks } from "@/components/site/kurumsal/share-links";
import { PostCard, formatPostDate, type BlogListPost } from "../content";

interface SerializedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  coverImage: string | null;
  author: string | null;
  tags: string[];
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; slug: string } | null;
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://kleacore.com").replace(/\/+$/, "");
}

export function BlogPostContent({
  post,
  recentPosts,
}: {
  post: SerializedPost;
  recentPosts: BlogListPost[];
}) {
  const content = post.content ?? "";
  const { blocks, toc } = parseMarkdown(content);
  const url = `${siteUrl()}/blog/${post.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt ?? undefined,
    datePublished: post.publishedAt ?? post.createdAt,
    dateModified: post.updatedAt,
    author: { "@type": "Organization", name: post.author || "KLEACORE" },
    publisher: { "@type": "Organization", name: "KLEACORE" },
    mainEntityOfPage: url,
    keywords: post.tags.join(", ") || undefined,
  };

  return (
    <ArticleLayout
      breadcrumbs={[{ label: "Blog", href: "/blog" }, { label: post.title }]}
      eyebrow={
        post.category ? (
          <Link
            href={`/blog?kategori=${post.category.slug}`}
            className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {post.category.name}
          </Link>
        ) : (
          "Blog"
        )
      }
      title={post.title}
      description={post.excerpt}
      meta={
        <ArticleMeta
          items={[
            post.publishedAt ? (
              <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
            ) : null,
            `${readingMinutes(content)} dk okuma`,
            post.author,
          ]}
        />
      }
      toc={toc}
      footer={
        <>
          <TagList tags={post.tags} />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Paylaş
              </p>
              <ShareLinks url={url} title={post.title} />
            </div>
            <Link href="/blog" className={buttonClasses({ variant: "outline" })}>
              <ArrowLeft aria-hidden className="size-4" />
              Tüm yazılar
            </Link>
          </div>
        </>
      }
      after={
        recentPosts.length > 0 ? (
          <Section tone="muted" divider aria-labelledby="diger-yazilar">
            <SectionHeading id="diger-yazilar" eyebrow="Blog" title="Diğer yazılar" className="mb-10" />
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {recentPosts.map((p) => (
                <li key={p.id}>
                  <PostCard post={p} />
                </li>
              ))}
            </ul>
          </Section>
        ) : null
      }
    >
      <MarkdownBlocks blocks={blocks} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </ArticleLayout>
  );
}
