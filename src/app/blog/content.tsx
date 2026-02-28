"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BlurFade } from "@/components/magicui/blur-fade";
import {
  BookOpen,
  Calendar,
  Clock,
  User,
  ArrowRight,
  Tag,
  Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeNewsletter } from "@/lib/actions/contact";
import { toast } from "@/lib/toast";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  author: string | null;
  tags: string[];
  viewCount: number;
  publishedAt: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}

interface BlogContentProps {
  posts: BlogPost[];
  categories: BlogCategory[];
  page: number;
  totalPages: number;
  total: number;
  search: string;
}

export function BlogContent({
  posts,
  categories,
  page,
  totalPages,
  total,
  search,
}: BlogContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(search);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);

  const featuredPost = posts[0] ?? null;
  const gridPosts = posts.slice(1);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchInput.trim()) {
      params.set("search", searchInput.trim());
    } else {
      params.delete("search");
    }
    params.set("page", "1");
    router.push(`/blog?${params.toString()}`);
  };

  const goToPage = (targetPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(targetPage));
    router.push(`/blog?${params.toString()}`);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Collect unique tags from posts
  const allTags = Array.from(
    new Set(posts.flatMap((p) => p.tags).filter(Boolean))
  ).slice(0, 10);

  const handleNewsletterSubscribe = async () => {
    if (!newsletterEmail.trim()) {
      toast.error("Lutfen e-posta adresinizi girin.");
      return;
    }

    setIsSubscribing(true);
    try {
      const result = await subscribeNewsletter(newsletterEmail, "blog");
      if (!result.success) {
        toast.error(result.error ?? "Abonelik tamamlanamadi.");
        return;
      }

      toast.success(result.message ?? "Abonelik basariyla tamamlandi.");
      setNewsletterEmail("");
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm font-medium mb-4">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Blog
                </div>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                  Hosting & Teknoloji Blog
                </h1>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                  Web hosting, güvenlik, performans ve dijital dünya hakkında
                  en güncel bilgiler ve ipuçları.
                </p>
              </div>
            </BlurFade>

            {/* Search */}
            <BlurFade delay={0.2} inView>
              <form onSubmit={handleSearch} className="max-w-xl mx-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Blog yazılarında ara..."
                    className="pl-10 h-12"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </div>
              </form>
            </BlurFade>
          </div>
        </section>

        {/* Featured Post */}
        {featuredPost && !search && (
          <section className="py-16 md:py-24">
            <div className="container">
              <BlurFade delay={0.1} inView>
                <div className="max-w-6xl mx-auto">
                  <h2 className="text-2xl font-bold mb-8">Öne Çıkan Yazı</h2>
                  <Card className="overflow-hidden hover:border-primary/50 transition-colors">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="aspect-video md:aspect-auto bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <BookOpen className="h-16 w-16 text-primary/50" />
                      </div>
                      <CardContent className="p-6 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-3">
                          {featuredPost.category && (
                            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                              {featuredPost.category.name}
                            </span>
                          )}
                        </div>
                        <h3 className="text-2xl font-bold mb-3">
                          <Link
                            href={`/blog/${featuredPost.slug}`}
                            className="hover:text-primary transition-colors"
                          >
                            {featuredPost.title}
                          </Link>
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          {featuredPost.excerpt}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {featuredPost.author && (
                            <span className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              {featuredPost.author}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(featuredPost.publishedAt)}
                          </span>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                </div>
              </BlurFade>
            </div>
          </section>
        )}

        {/* Blog Posts Grid */}
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container">
            <div className="grid gap-12 lg:grid-cols-4 max-w-6xl mx-auto">
              {/* Posts */}
              <div className="lg:col-span-3">
                <BlurFade delay={0.1} inView>
                  <h2 className="text-2xl font-bold mb-8">
                    {search ? `"${search}" için sonuçlar (${total})` : "Son Yazılar"}
                  </h2>

                  {(search ? posts : gridPosts).length === 0 ? (
                    <Card>
                      <CardContent className="p-12 text-center">
                        <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                        <h3 className="font-semibold text-lg mb-2">Yazı bulunamadı</h3>
                        <p className="text-sm text-muted-foreground">
                          Arama kriterlerinize uygun yazı bulunamadı. Farklı anahtar kelimeler deneyin.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2">
                      {(search ? posts : gridPosts).map((post) => (
                        <Card
                          key={post.id}
                          className="overflow-hidden hover:border-primary/50 transition-colors"
                        >
                          <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                            <BookOpen className="h-10 w-10 text-muted-foreground/50" />
                          </div>
                          <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                              {post.category && (
                                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                  {post.category.name}
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold mb-2 line-clamp-2">
                              <Link
                                href={`/blog/${post.slug}`}
                                className="hover:text-primary transition-colors"
                              >
                                {post.title}
                              </Link>
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                              {post.excerpt}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {post.author && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {post.author}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(post.publishedAt)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-12">
                      <Button
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() => goToPage(page - 1)}
                      >
                        Onceki
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (p) => (
                          <Button
                            key={p}
                            variant="outline"
                            className={
                              p === page
                                ? "bg-primary text-primary-foreground"
                                : ""
                            }
                            onClick={() => goToPage(p)}
                          >
                            {p}
                          </Button>
                        )
                      )}
                      <Button
                        variant="outline"
                        disabled={page >= totalPages}
                        onClick={() => goToPage(page + 1)}
                      >
                        Sonraki
                      </Button>
                    </div>
                  )}
                </BlurFade>
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-1">
                <BlurFade delay={0.2} inView>
                  <div className="space-y-8">
                    {/* Categories */}
                    {categories.length > 0 && (
                      <Card>
                        <CardContent className="p-5">
                          <h3 className="font-semibold mb-4">Kategoriler</h3>
                          <ul className="space-y-2">
                            {categories.map((category) => (
                              <li key={category.id}>
                                <Link
                                  href={`/blog/kategori/${category.slug}`}
                                  className="flex items-center justify-between py-1.5 text-sm hover:text-primary transition-colors"
                                >
                                  <span>{category.name}</span>
                                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                    {category.postCount}
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {/* Popular Tags */}
                    {allTags.length > 0 && (
                      <Card>
                        <CardContent className="p-5">
                          <h3 className="font-semibold mb-4">Populer Etiketler</h3>
                          <div className="flex flex-wrap gap-2">
                            {allTags.map((tag) => (
                              <Link
                                key={tag}
                                href={`/blog/etiket/${tag.toLowerCase()}`}
                                className="px-3 py-1 rounded-full bg-muted text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                              >
                                {tag}
                              </Link>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Newsletter */}
                    <Card className="bg-primary text-primary-foreground">
                      <CardContent className="p-5">
                        <h3 className="font-semibold mb-2">Bültenimize Katılın</h3>
                        <p className="text-sm opacity-90 mb-4">
                          En son yazılar ve hosting ipuçları için abone olun.
                        </p>
                        <div className="space-y-2">
                          <Input
                            placeholder="E-posta adresiniz"
                            value={newsletterEmail}
                            onChange={(event) => setNewsletterEmail(event.target.value)}
                            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/60"
                          />
                          <Button
                            variant="secondary"
                            className="w-full"
                            onClick={handleNewsletterSubscribe}
                            disabled={isSubscribing}
                          >
                            {isSubscribing ? "Kaydediliyor..." : "Abone Ol"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </BlurFade>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                  Hosting Hizmetlerimizi Keşfedin
                </h2>
                <p className="text-muted-foreground mb-8">
                  Blog yazılarımızda öğrendiklerinizi uygulamak için güvenilir
                  hosting altyapımızı deneyin.
                </p>
                <Button size="lg" className="px-8" asChild>
                  <Link href="/hosting">
                    Hosting Paketleri
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </BlurFade>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
