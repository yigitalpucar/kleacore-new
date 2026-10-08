import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { FaqSection, type FaqItem } from "@/components/site/faq-section";
import { CtaBand } from "@/components/site/cta-band";
import { SiteShell } from "@/components/site/kurumsal/site-shell";
import { kbIcon } from "./kb-icons";
import { KbSearch, type KbSearchItem } from "./kb-search";

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  articleCount: number;
}

interface ArticleLink {
  id: string;
  title: string;
  slug: string;
  categoryName: string;
  categorySlug: string;
  publishedAt?: string | null;
}

interface BilgiBankasiContentProps {
  categories: CategoryItem[];
  searchIndex: KbSearchItem[];
  popularArticles: ArticleLink[];
  recentArticles: ArticleLink[];
}

const faqs: FaqItem[] = [
  {
    question: "Hosting paketimi nasıl yükseltebilirim?",
    answer:
      "Müşteri panelinize giriş yaparak hizmetiniz için destek talebi oluşturabilirsiniz; paket yükseltme işleminiz destek ekibimiz tarafından yapılır.",
  },
  {
    question: "Domain transferi ne kadar sürer?",
    answer:
      "Domain transferi genellikle 5-7 gün sürer. Süre, uzantıya ve mevcut kayıt firmasının onayına göre değişebilir.",
  },
  {
    question: "SSL sertifikam ne zaman aktif olur?",
    answer:
      "Ücretsiz SSL sertifikaları genellikle birkaç dakika içinde aktif olur. Ücretli sertifikalar doğrulama sürecine bağlı olarak 1-3 gün sürebilir.",
  },
  {
    question: "Yedeklemeler ne sıklıkla alınıyor?",
    answer:
      "Hosting paketinize göre haftalık veya günlük otomatik yedek alınır. Paketinizdeki yedekleme sıklığını paket detaylarında görebilirsiniz.",
  },
];

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ArticleList({ articles, showDate }: { articles: ArticleLink[]; showDate?: boolean }) {
  return (
    <ul className="divide-y">
      {articles.map((article) => (
        <li key={article.id}>
          <Link
            href={`/bilgi-bankasi/${article.categorySlug}/${article.slug}`}
            className="group flex min-h-14 items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium leading-snug group-hover:underline group-hover:underline-offset-4">
                {article.title}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {article.categoryName}
                {showDate && article.publishedAt ? ` · ${formatDate(article.publishedAt)}` : ""}
              </span>
            </span>
            <ArrowUpRight
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function BilgiBankasiContent({
  categories,
  searchIndex,
  popularArticles,
  recentArticles,
}: BilgiBankasiContentProps) {
  return (
    <SiteShell>
      <PageHeader
        eyebrow="Bilgi bankası"
        title="Nasıl yardımcı olabiliriz?"
        description="Hosting, alan adı, SSL ve daha fazlası hakkında adım adım rehberler ve çözümler."
        breadcrumbs={[{ label: "Bilgi Bankası" }]}
      >
        <KbSearch items={searchIndex} />
      </PageHeader>

      <Section aria-labelledby="kategoriler">
        <SectionHeading
          id="kategoriler"
          eyebrow="Kategoriler"
          title="Konuya göre göz atın"
          className="mb-10"
        />
        {categories.length === 0 ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Henüz kategori bulunmuyor.
          </p>
        ) : (
          <ul className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => {
              const Icon = kbIcon(category.icon);
              return (
                <li key={category.id} className="bg-background">
                  <Link
                    href={`/bilgi-bankasi/${category.slug}`}
                    className="group flex h-full items-start gap-4 p-6 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:p-8"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 transition-colors group-hover:bg-background">
                      <Icon aria-hidden className="size-5 text-foreground/80" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-base font-medium tracking-tight">{category.name}</span>
                        <ArrowUpRight
                          aria-hidden
                          className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                        />
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">{category.description}</span>
                      <span className="mt-3 block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        {category.articleCount} makale
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {popularArticles.length > 0 || recentArticles.length > 0 ? (
        <Section tone="muted" divider aria-label="Öne çıkan makaleler">
          <div className="grid gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-2">
            {popularArticles.length > 0 ? (
              <div className="bg-background p-6 md:p-8">
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Popüler makaleler
                </h2>
                <div className="mt-4">
                  <ArticleList articles={popularArticles} />
                </div>
              </div>
            ) : null}
            {recentArticles.length > 0 ? (
              <div className="bg-background p-6 md:p-8">
                <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Son eklenenler
                </h2>
                <div className="mt-4">
                  <ArticleList articles={recentArticles} showDate />
                </div>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      <FaqSection
        items={faqs}
        eyebrow="SSS"
        title="Sık sorulan sorular"
        description="En çok merak edilen sorular ve cevapları."
        divider
      />

      <CtaBand
        eyebrow="Destek"
        title="Aradığınızı bulamadınız mı?"
        description="Destek ekibimiz yardımcı olmaktan mutluluk duyar. Destek merkezinden talep oluşturun veya bize yazın."
        primary={{ label: "Destek merkezi", href: "/musteri/destek" }}
        secondary={{ label: "Bize ulaşın", href: "/iletisim" }}
      />
    </SiteShell>
  );
}
