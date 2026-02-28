"use client";

import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Printer,
  ArrowLeft,
  FileText,
  BookOpen,
  Server,
  Globe,
  Shield,
  Mail,
  Database,
  Settings,
  HelpCircle,
  Eye,
  type LucideIcon,
} from "lucide-react";

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  Server,
  Globe,
  Shield,
  Mail,
  Database,
  Settings,
  BookOpen,
  HelpCircle,
  FileText,
};

// Category slug'a göre renk mapping
const colorMap: Record<string, { color: string; bgColor: string }> = {
  hosting: { color: "text-blue-500", bgColor: "bg-blue-500/10" },
  domain: { color: "text-green-500", bgColor: "bg-green-500/10" },
  ssl: { color: "text-purple-500", bgColor: "bg-purple-500/10" },
  email: { color: "text-orange-500", bgColor: "bg-orange-500/10" },
  sunucu: { color: "text-red-500", bgColor: "bg-red-500/10" },
  teknik: { color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
};

const defaultColors = { color: "text-primary", bgColor: "bg-primary/10" };

// --- Interfaces ---

interface SerializedCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  articleCount: number;
}

interface SerializedCategoryArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  categorySlug: string;
}

interface SerializedArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  tags: string[];
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  publishedAt: string | null;
  updatedAt: string;
  category: {
    name: string;
    slug: string;
    icon: string;
  };
}

// --- Helpers ---

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function estimateReadTime(content: string): string {
  const wordCount = content.split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return `${minutes} dk`;
}

// --- Category Content ---

interface CategoryContentProps {
  category: SerializedCategory;
  articles: SerializedCategoryArticle[];
}

export function CategoryContent({ category, articles }: CategoryContentProps) {
  const IconComponent = iconMap[category.icon] || BookOpen;
  const colors = colorMap[category.slug] || defaultColors;

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="py-12 md:py-16 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <BlurFade delay={0.1} inView>
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                <Link href="/bilgi-bankasi" className="hover:text-foreground">
                  Bilgi Bankası
                </Link>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground">{category.name}</span>
              </nav>

              <div className="flex items-center gap-4">
                <div className={`flex h-16 w-16 items-center justify-center rounded-xl ${colors.bgColor}`}>
                  <IconComponent className={`h-8 w-8 ${colors.color}`} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    {category.name}
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    {category.description}
                  </p>
                </div>
              </div>
            </BlurFade>
          </div>
        </section>

        {/* Articles List */}
        <section className="py-12 md:py-16">
          <div className="container">
            <BlurFade delay={0.2} inView>
              <div className="max-w-4xl">
                <h2 className="text-xl font-semibold mb-6">
                  Makaleler ({articles.length})
                </h2>
                {articles.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">
                        Bu kategoride henüz makale bulunmuyor.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {articles.map((article) => (
                      <Link
                        key={article.id}
                        href={`/bilgi-bankasi/${article.categorySlug}/${article.slug}`}
                      >
                        <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
                          <CardContent className="p-5">
                            <div className="flex items-center gap-4">
                              <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                              <div className="flex-1">
                                <h3 className="font-medium group-hover:text-primary transition-colors">
                                  {article.title}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {article.content}
                                </p>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </BlurFade>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

// --- Article Content ---

interface ArticleContentProps {
  article: SerializedArticle;
}

export function ArticleContent({ article }: ArticleContentProps) {
  const IconComponent = iconMap[article.category.icon] || BookOpen;
  const colors = colorMap[article.category.slug] || defaultColors;

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1">
        {/* Article Header */}
        <section className="py-8 md:py-12 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <BlurFade delay={0.1} inView>
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                <Link href="/bilgi-bankasi" className="hover:text-foreground">
                  Bilgi Bankası
                </Link>
                <ChevronRight className="h-4 w-4" />
                <Link
                  href={`/bilgi-bankasi/${article.category.slug}`}
                  className="hover:text-foreground"
                >
                  {article.category.name}
                </Link>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground truncate max-w-[200px]">
                  {article.title}
                </span>
              </nav>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                {article.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {estimateReadTime(article.content)} okuma
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {article.viewCount} görüntülenme
                </span>
                {article.updatedAt && (
                  <span>Güncelleme: {formatDate(article.updatedAt)}</span>
                )}
              </div>
            </BlurFade>
          </div>
        </section>

        {/* Article Content */}
        <section className="py-8 md:py-12">
          <div className="container">
            <div className="grid gap-8 lg:grid-cols-4">
              {/* Main Content */}
              <BlurFade delay={0.2} inView className="lg:col-span-3">
                <Card>
                  <CardContent className="p-6 md:p-8">
                    <article className="prose prose-gray dark:prose-invert max-w-none">
                      {article.content.split("\n").map((line, idx) => {
                        if (line.startsWith("## ")) {
                          return (
                            <h2 key={idx} className="text-xl font-bold mt-8 mb-4">
                              {line.replace("## ", "")}
                            </h2>
                          );
                        }
                        if (line.startsWith("### ")) {
                          return (
                            <h3 key={idx} className="text-lg font-semibold mt-6 mb-3">
                              {line.replace("### ", "")}
                            </h3>
                          );
                        }
                        if (line.startsWith("```")) {
                          return null;
                        }
                        if (line.startsWith("- ")) {
                          return (
                            <li key={idx} className="ml-4">
                              {line.replace("- ", "")}
                            </li>
                          );
                        }
                        if (line.match(/^\d+\. /)) {
                          return (
                            <li key={idx} className="ml-4 list-decimal">
                              {line.replace(/^\d+\. /, "")}
                            </li>
                          );
                        }
                        if (line.trim() === "") {
                          return <br key={idx} />;
                        }
                        return (
                          <p key={idx} className="mb-3 text-muted-foreground">
                            {line}
                          </p>
                        );
                      })}
                    </article>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-4 mt-8 pt-8 border-t">
                      <span className="text-sm text-muted-foreground">
                        Bu makale yardımcı oldu mu?
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          Evet ({article.helpfulCount})
                        </Button>
                        <Button variant="outline" size="sm">
                          <ThumbsDown className="h-4 w-4 mr-1" />
                          Hayır ({article.notHelpfulCount})
                        </Button>
                      </div>
                      <div className="flex gap-2 ml-auto">
                        <Button variant="ghost" size="sm">
                          <Share2 className="h-4 w-4 mr-1" />
                          Paylaş
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Printer className="h-4 w-4 mr-1" />
                          Yazdır
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </BlurFade>

              {/* Sidebar */}
              <BlurFade delay={0.3} inView className="space-y-6">
                {/* Tags */}
                {article.tags.length > 0 && (
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="font-semibold mb-4">Etiketler</h3>
                      <div className="flex flex-wrap gap-2">
                        {article.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-muted px-2 py-1 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Need Help */}
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-5 text-center">
                    <h3 className="font-semibold mb-2">Yardıma mı ihtiyacınız var?</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Teknik ekibimiz size yardımcı olmaya hazır.
                    </p>
                    <Link href="/musteri/panel/destek/yeni">
                      <Button size="sm" className="w-full">
                        Destek Talebi Oluştur
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Back Button */}
                <Link href={`/bilgi-bankasi/${article.category.slug}`}>
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {article.category.name} Makaleleri
                  </Button>
                </Link>
              </BlurFade>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
