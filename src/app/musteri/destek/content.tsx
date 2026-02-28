"use client";

import { useState } from "react";
import { BlurFade } from "@/components/magicui/blur-fade";
import {
  Headphones,
  MessageSquare,
  Phone,
  Mail,
  Search,
  Book,
  FileQuestion,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import * as LucideIcons from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  _count: { articles: number };
}

interface Article {
  id: string;
  title: string;
  slug: string;
  viewCount: number;
  category: { name: string; slug: string } | null;
}

const contactChannels = [
  {
    icon: MessageSquare,
    title: "Canlı Destek",
    description: "Anlık yardım alın",
    availability: "7/24",
    action: "Sohbet Başlat",
    primary: true,
  },
  {
    icon: Headphones,
    title: "Destek Talebi",
    description: "Ticket oluşturun",
    availability: "24 saat içinde yanıt",
    action: "Talep Oluştur",
    primary: false,
  },
  {
    icon: Phone,
    title: "Telefon",
    description: "0850 123 45 67",
    availability: "Pzt-Cuma 09:00-18:00",
    action: "Ara",
    primary: false,
  },
];

const faqs = [
  {
    q: "Hosting paketimi nasıl yükseltebilirim?",
    a: "Müşteri panelinizden Hizmetlerim bölümüne giderek mevcut paketinizi yükseltebilirsiniz.",
  },
  {
    q: "Alan adımı nasıl transfer edebilirim?",
    a: "Mevcut kayıt firmanızdan EPP/Auth kodu alarak transfer işlemini başlatabilirsiniz.",
  },
  {
    q: "SSL sertifikam ne zaman aktif olur?",
    a: "DV SSL sertifikaları dakikalar içinde, OV ve EV sertifikaları doğrulama sürecine bağlı olarak 1-7 gün içinde aktif olur.",
  },
  {
    q: "Yedekleme nasıl yapılır?",
    a: "cPanel'den Yedekleme Sihirbazı ile tam veya kısmi yedek alabilirsiniz. Otomatik yedekleme de mevcuttur.",
  },
];

function getDynamicIcon(iconName: string) {
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
  return icons[iconName] || Book;
}

export function DestekContent({
  categories,
  popularArticles,
}: {
  categories: Category[];
  popularArticles: Article[];
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = searchQuery
    ? categories.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.description.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : categories;

  const filteredArticles = searchQuery
    ? popularArticles.filter((a) =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : popularArticles;

  return (
    <>
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
        <div className="container">
          <BlurFade delay={0.1} inView>
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm font-medium mb-4">
                <Headphones className="h-4 w-4 text-primary" />
                7/24 Destek
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                Destek Merkezi
              </h1>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                Size nasıl yardımcı olabiliriz? Bilgi bankamızda arama yapın
                veya destek ekibimize ulaşın.
              </p>
            </div>
          </BlurFade>

          {/* Search */}
          <BlurFade delay={0.15} inView>
            <div className="max-w-2xl mx-auto mb-12">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Sorununuzu veya aradığınız konuyu yazın..."
                  className="pl-12 h-14 text-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setSearchQuery("")}
                  >
                    Temizle
                  </Button>
                )}
              </div>
            </div>
          </BlurFade>

          {/* Contact Channels */}
          <BlurFade delay={0.2} inView>
            <div className="grid gap-4 sm:grid-cols-3 max-w-4xl mx-auto">
              {contactChannels.map((channel) => (
                <Card
                  key={channel.title}
                  className={`text-center ${
                    channel.primary ? "border-primary" : ""
                  }`}
                >
                  <CardContent className="p-6">
                    <channel.icon
                      className={`h-10 w-10 mx-auto mb-3 ${
                        channel.primary ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <h3 className="font-semibold mb-1">{channel.title}</h3>
                    <p className="text-sm text-muted-foreground mb-1">
                      {channel.description}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {channel.availability}
                    </p>
                    <Button
                      variant={channel.primary ? "default" : "outline"}
                      size="sm"
                      className="w-full"
                    >
                      {channel.action}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </BlurFade>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 md:py-24">
        <div className="container">
          <BlurFade delay={0.1} inView>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Yardım Kategorileri
              </h2>
              <p className="mt-4 text-muted-foreground">
                Konuya göre yardım makalelerini inceleyin
              </p>
            </div>
          </BlurFade>

          <BlurFade delay={0.2} inView>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((category) => {
                  const IconComp = getDynamicIcon(category.icon);
                  return (
                    <Link key={category.id} href={`/musteri/destek/${category.slug}`}>
                      <Card className="hover:border-primary/50 transition-colors cursor-pointer group h-full">
                        <CardContent className="p-6">
                          <IconComp className="h-10 w-10 text-primary mb-4" />
                          <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                            {category.name}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            {category.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {category._count.articles} makale
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-8">
                  <p className="text-muted-foreground">
                    Aramanızla eşleşen kategori bulunamadı.
                  </p>
                </div>
              )}
            </div>
          </BlurFade>
        </div>
      </section>

      {/* Popular Articles */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container">
          <BlurFade delay={0.1} inView>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Popüler Makaleler
              </h2>
              <p className="mt-4 text-muted-foreground">
                En çok okunan yardım makaleleri
              </p>
            </div>
          </BlurFade>

          <BlurFade delay={0.2} inView>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
              {filteredArticles.length > 0 ? (
                filteredArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/musteri/destek/makale/${article.slug}`}
                    className="flex items-center gap-4 p-4 bg-card border rounded-lg hover:border-primary/50 transition-colors group"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                      <Book className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                        {article.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {article.category?.name ?? "Genel"} • {article.viewCount.toLocaleString()} görüntülenme
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </Link>
                ))
              ) : (
                <div className="col-span-full text-center py-8">
                  <p className="text-muted-foreground">
                    Aramanızla eşleşen makale bulunamadı.
                  </p>
                </div>
              )}
            </div>
          </BlurFade>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24">
        <div className="container">
          <BlurFade delay={0.1} inView>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Sık Sorulan Sorular
              </h2>
            </div>
          </BlurFade>

          <BlurFade delay={0.2} inView>
            <div className="grid gap-4 max-w-3xl mx-auto">
              {faqs.map((faq) => (
                <Card key={faq.q}>
                  <CardContent className="p-6">
                    <div className="flex gap-3">
                      <FileQuestion className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium mb-2">{faq.q}</h3>
                        <p className="text-sm text-muted-foreground">{faq.a}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </BlurFade>

          <BlurFade delay={0.3} inView>
            <div className="text-center mt-8">
              <Button variant="outline">
                Tüm SSS
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </BlurFade>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-primary/5">
        <div className="container">
          <BlurFade delay={0.1} inView>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                Hala Yardıma mı İhtiyacınız Var?
              </h2>
              <p className="text-muted-foreground mb-8">
                Destek ekibimiz size yardımcı olmak için hazır.
                Hemen bir destek talebi oluşturun.
              </p>
              <Button size="lg" className="px-8">
                Destek Talebi Oluştur
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </BlurFade>
        </div>
      </section>
    </>
  );
}
