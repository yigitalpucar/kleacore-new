import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { CtaBand } from "@/components/site/cta-band";
import { buttonClasses } from "@/components/site/button-classes";
import { SiteShell } from "@/components/site/kurumsal/site-shell";
import { PostCover } from "@/components/site/kurumsal/post-cover";
import { BlogNewsletter, BlogSearch } from "./blog-forms";

export interface BlogListPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  author: string | null;
  tags: string[];
  viewCount: number;
  publishedAt: string | null;
  category: { id: string; name: string; slug: string } | null;
}

export interface BlogListCategory {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}

interface BlogContentProps {
  posts: BlogListPost[];
  categories: BlogListCategory[];
  activeCategory: string;
  page: number;
  totalPages: number;
  total: number;
  search: string;
}

export function formatPostDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function blogHref(params: { kategori?: string; search?: string; page?: number }) {
  const qs = new URLSearchParams();
  if (params.kategori) qs.set("kategori", params.kategori);
  if (params.search) qs.set("search", params.search);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const s = qs.toString();
  return s ? `/blog?${s}` : "/blog";
}

function Cover({ post, size = "md", className }: { post: BlogListPost; size?: "md" | "lg"; className?: string }) {
  if (post.coverImage) {
    return (
      <div className={cn("relative overflow-hidden bg-muted", className)}>
        {/* Cover URLs come from the CMS and may be on any host, so next/image is not used. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.coverImage} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      </div>
    );
  }
  return (
    <PostCover
      categorySlug={post.category?.slug}
      size={size}
      className={className}
    />
  );
}

export function PostCard({ post }: { post: BlogListPost }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border bg-background transition-shadow hover:shadow-md">
      <Cover post={post} className="aspect-[16/9] border-b" />
      <div className="flex flex-1 flex-col p-5">
        {post.category ? (
          <span className="w-fit rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {post.category.name}
          </span>
        ) : null}
        <h3 className="mt-3 text-base font-medium leading-snug tracking-tight">
          <Link
            href={`/blog/${post.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
          >
            {post.title}
          </Link>
        </h3>
        {post.excerpt ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
        ) : null}
        <p className="mt-auto pt-4 text-xs text-muted-foreground">
          {post.publishedAt ? <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time> : null}
          {post.author ? <span> · {post.author}</span> : null}
        </p>
      </div>
    </article>
  );
}

export function BlogContent({
  posts,
  categories,
  activeCategory,
  page,
  totalPages,
  total,
  search,
}: BlogContentProps) {
  const filtering = Boolean(search || activeCategory || page > 1);
  const featuredPost = !filtering ? (posts[0] ?? null) : null;
  const gridPosts = featuredPost ? posts.slice(1) : posts;
  const activeCategoryName = categories.find((c) => c.slug === activeCategory)?.name;

  const listTitle = search
    ? `"${search}" için sonuçlar (${total})`
    : activeCategoryName
      ? `${activeCategoryName} (${total})`
      : featuredPost
        ? "Son yazılar"
        : "Tüm yazılar";

  return (
    <SiteShell>
      <PageHeader
        eyebrow="Blog"
        title="Hosting ve teknoloji rehberleri"
        description="Alan adı, web hosting, SSL, sunucu ve e-posta hakkında anlaşılır Türkçe rehberler ve ipuçları."
        breadcrumbs={[{ label: "Blog" }]}
      >
        <BlogSearch initial={search} kategori={activeCategory} />
      </PageHeader>

      {/* Category filter (same page, query string) */}
      {categories.length > 0 ? (
        <nav aria-label="Blog kategorileri" className="border-b">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <ul className="-mx-1 flex flex-wrap gap-2 py-4">
              <li>
                <Link
                  href={blogHref({ search })}
                  aria-current={!activeCategory ? "page" : undefined}
                  className={chipClass(!activeCategory)}
                >
                  Tümü
                </Link>
              </li>
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={blogHref({ kategori: category.slug, search })}
                    aria-current={activeCategory === category.slug ? "page" : undefined}
                    className={chipClass(activeCategory === category.slug)}
                  >
                    {category.name}
                    <span className="font-mono text-[10px] opacity-60">{category.postCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      ) : null}

      {featuredPost ? (
        <Section spacing="sm" aria-labelledby="one-cikan">
          <h2 id="one-cikan" className="sr-only">
            Öne çıkan yazı
          </h2>
          <article className="group relative grid overflow-hidden rounded-2xl border bg-background transition-shadow hover:shadow-md md:grid-cols-2">
            <Cover post={featuredPost} size="lg" className="aspect-[16/10] border-b md:aspect-auto md:min-h-[22rem] md:border-b-0 md:border-r" />
            <div className="flex flex-col justify-center p-6 sm:p-10">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Öne çıkan{featuredPost.category ? ` · ${featuredPost.category.name}` : ""}
              </p>
              <h3 className="mt-4 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                <Link
                  href={`/blog/${featuredPost.slug}`}
                  className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                >
                  {featuredPost.title}
                </Link>
              </h3>
              {featuredPost.excerpt ? (
                <p className="mt-4 leading-relaxed text-muted-foreground">{featuredPost.excerpt}</p>
              ) : null}
              <div className="mt-6 flex items-center justify-between gap-4 text-sm text-muted-foreground">
                <span>
                  {featuredPost.publishedAt ? (
                    <time dateTime={featuredPost.publishedAt}>{formatPostDate(featuredPost.publishedAt)}</time>
                  ) : null}
                  {featuredPost.author ? ` · ${featuredPost.author}` : ""}
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  Oku
                  <ArrowUpRight aria-hidden className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </article>
        </Section>
      ) : null}

      <Section spacing={featuredPost ? "sm" : "default"} className={featuredPost ? "pt-0 md:pt-0" : undefined} aria-labelledby="yazilar">
        <SectionHeading
          id="yazilar"
          title={listTitle}
          className="mb-8 [&_h2]:text-2xl [&_h2]:sm:text-3xl"
          actions={
            filtering ? (
              <Link href="/blog" className={buttonClasses({ variant: "ghost", size: "sm" })}>
                Filtreleri temizle
              </Link>
            ) : undefined
          }
        />

        {gridPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center sm:p-14">
            <h3 className="text-lg font-medium">Yazı bulunamadı</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {search
                ? "Arama kriterlerinize uygun yazı bulunamadı. Farklı anahtar kelimeler deneyin."
                : "Bu bölümde henüz yazı bulunmuyor."}
            </p>
            <Link href="/blog" className={buttonClasses({ variant: "outline", className: "mt-6" })}>
              Tüm yazılar
            </Link>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gridPosts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <nav aria-label="Sayfalama" className="mt-12 flex flex-wrap items-center justify-center gap-2">
            <PageLink href={blogHref({ kategori: activeCategory, search, page: page - 1 })} disabled={page <= 1} label="Önceki sayfa">
              <ChevronLeft aria-hidden className="size-4" />
            </PageLink>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <PageLink
                key={p}
                href={blogHref({ kategori: activeCategory, search, page: p })}
                current={p === page}
                label={`Sayfa ${p}`}
              >
                {p}
              </PageLink>
            ))}
            <PageLink href={blogHref({ kategori: activeCategory, search, page: page + 1 })} disabled={page >= totalPages} label="Sonraki sayfa">
              <ChevronRight aria-hidden className="size-4" />
            </PageLink>
          </nav>
        ) : null}
      </Section>

      <Section tone="muted" divider aria-labelledby="bulten">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <SectionHeading
            id="bulten"
            eyebrow="Bülten"
            title="Yeni yazılardan haberdar olun"
            description="Yeni rehberler ve hosting ipuçları yayınlandığında e-posta ile bilgi alın."
          />
          <BlogNewsletter />
        </div>
      </Section>

      <CtaBand
        eyebrow="Hosting"
        title="Öğrendiklerinizi uygulamaya geçirin"
        description="cPanel ve LiteSpeed ile Linux hosting paketlerini inceleyin; ücretsiz Let's Encrypt SSL dahil."
        primary={{ label: "Hosting paketleri", href: "/hosting/linux" }}
        secondary={{ label: "Bilgi bankası", href: "/bilgi-bankasi" }}
      />
    </SiteShell>
  );
}

function chipClass(active: boolean) {
  return cn(
    "inline-flex min-h-11 items-center gap-2 rounded-md border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "border-foreground bg-foreground text-background"
      : "bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
  );
}

function PageLink({
  href,
  disabled,
  current,
  label,
  children,
}: {
  href: string;
  disabled?: boolean;
  current?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const cls = cn(
    "inline-flex size-11 items-center justify-center rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    current ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted/60",
    disabled && "pointer-events-none opacity-40"
  );
  if (disabled) {
    return (
      <span aria-disabled="true" aria-label={label} className={cls}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} aria-current={current ? "page" : undefined} className={cls}>
      {children}
    </Link>
  );
}

