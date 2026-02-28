"use client";

import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  User,
  Tag,
  ChevronRight,
  Share2,
  Facebook,
  Linkedin,
  ArrowLeft,
  BookOpen,
} from "lucide-react";

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
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface RecentPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface BlogPostContentProps {
  post: SerializedPost;
  recentPosts: RecentPost[];
}

export function BlogPostContent({ post, recentPosts }: BlogPostContentProps) {
  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const renderContent = (content: string) => {
    return content.split("\n").map((line, idx) => {
      if (line.startsWith("## ")) {
        return (
          <h2 key={idx} className="text-2xl font-bold mt-10 mb-4">
            {line.replace("## ", "")}
          </h2>
        );
      }
      if (line.startsWith("### ")) {
        return (
          <h3 key={idx} className="text-xl font-semibold mt-8 mb-3">
            {line.replace("### ", "")}
          </h3>
        );
      }
      if (line.startsWith("**") && line.endsWith("**")) {
        return (
          <p key={idx} className="font-semibold mt-4 mb-2">
            {line.replace(/\*\*/g, "")}
          </p>
        );
      }
      if (line.startsWith("- ")) {
        return (
          <li key={idx} className="ml-4 mb-1">
            {line.replace("- ", "")}
          </li>
        );
      }
      if (line.startsWith("|")) {
        return null;
      }
      if (line.trim() === "") {
        return <br key={idx} />;
      }
      return (
        <p key={idx} className="mb-4 text-muted-foreground leading-relaxed">
          {line}
        </p>
      );
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1">
        {/* Article Header */}
        <section className="py-12 md:py-16 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="max-w-4xl mx-auto">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                  <Link href="/blog" className="hover:text-foreground">
                    Blog
                  </Link>
                  <ChevronRight className="h-4 w-4" />
                  <span>{post.category?.name ?? "Genel"}</span>
                </nav>

                {/* Category */}
                <div className="flex items-center gap-3 mb-4">
                  {post.category && (
                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {post.category.name}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
                  {post.title}
                </h1>

                {/* Excerpt */}
                {post.excerpt && (
                  <p className="text-lg text-muted-foreground mb-6">
                    {post.excerpt}
                  </p>
                )}

                {/* Author & Date */}
                <div className="flex items-center gap-6">
                  {post.author && (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{post.author}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {formatDate(post.publishedAt)}
                  </div>
                </div>
              </div>
            </BlurFade>
          </div>
        </section>

        {/* Article Content */}
        <section className="py-12 md:py-16">
          <div className="container">
            <div className="grid gap-12 lg:grid-cols-4 max-w-6xl mx-auto">
              {/* Main Content */}
              <BlurFade delay={0.2} inView className="lg:col-span-3">
                <Card>
                  <CardContent className="p-6 md:p-10">
                    <article className="prose prose-gray dark:prose-invert max-w-none">
                      {post.content && renderContent(post.content)}
                    </article>

                    {/* Tags */}
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mt-10 pt-8 border-t">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        {post.tags.map((tag) => (
                          <Link
                            key={tag}
                            href={`/blog/etiket/${tag.toLowerCase()}`}
                            className="px-3 py-1 rounded-full bg-muted text-sm hover:bg-primary hover:text-primary-foreground transition-colors"
                          >
                            {tag}
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* Share */}
                    <div className="flex items-center gap-4 mt-6 pt-6 border-t">
                      <span className="text-sm text-muted-foreground">
                        Paylas:
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                        >
                          <Facebook className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                        >
                          <Linkedin className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Author Box */}
                {post.author && (
                  <Card className="mt-8">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">
                            {post.author}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Web hosting ve dijital teknolojiler konusunda uzman
                            yazar. Teknik konulari anlasilir sekilde aktarmayi
                            seviyor.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </BlurFade>

              {/* Sidebar */}
              <BlurFade delay={0.3} inView className="space-y-6">
                {/* Related Posts */}
                {recentPosts.length > 0 && (
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        İlgili Yazılar
                      </h3>
                      <ul className="space-y-3">
                        {recentPosts.map((related) => (
                          <li key={related.id}>
                            <Link
                              href={`/blog/${related.slug}`}
                              className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
                            >
                              <ChevronRight className="h-3 w-3" />
                              {related.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Back to Blog */}
                <Link href="/blog">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Tüm Yazılar
                  </Button>
                </Link>
              </BlurFade>
            </div>
          </div>
        </section>

        {/* More Posts */}
        {recentPosts.length > 0 && (
          <section className="py-12 md:py-16 bg-muted/30">
            <div className="container">
              <BlurFade delay={0.1} inView>
                <div className="max-w-6xl mx-auto">
                  <h2 className="text-2xl font-bold mb-8">Diğer Yazılar</h2>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {recentPosts.map((otherPost) => (
                      <Card
                        key={otherPost.id}
                        className="overflow-hidden hover:border-primary/50 transition-colors"
                      >
                        <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                          <BookOpen className="h-10 w-10 text-muted-foreground/50" />
                        </div>
                        <CardContent className="p-5">
                          <div className="flex items-center gap-3 mb-3">
                            {otherPost.category && (
                              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                {otherPost.category.name}
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold mb-2 line-clamp-2">
                            <Link
                              href={`/blog/${otherPost.slug}`}
                              className="hover:text-primary transition-colors"
                            >
                              {otherPost.title}
                            </Link>
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {otherPost.excerpt}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </BlurFade>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
