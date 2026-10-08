import Link from "next/link";
import { Activity, ArrowUpRight, BookOpen, FileText, LifeBuoy, Mail } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { FaqSection, type FaqItem } from "@/components/site/faq-section";
import { CtaBand } from "@/components/site/cta-band";
import { Eyebrow } from "@/components/site/eyebrow";
import { SiteShell } from "@/components/site/kurumsal/site-shell";
import { kbIcon } from "@/app/bilgi-bankasi/kb-icons";
import { KbSearch, type KbSearchItem } from "@/app/bilgi-bankasi/kb-search";

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
}

interface DestekContentProps {
  categories: CategoryItem[];
  searchIndex: KbSearchItem[];
  popularArticles: ArticleLink[];
}

const channels = [
  {
    icon: LifeBuoy,
    title: "Destek talebi",
    description:
      "Hizmetinizle ilgili teknik veya idari konular için müşteri panelinden talep oluşturun; yazışmalar talep üzerinden ilerler.",
    note: "Müşteri paneli girişi gerekir",
    action: { label: "Talep oluştur", href: "/musteri/panel/destek/yeni" },
    external: false,
  },
  {
    icon: Mail,
    title: "E-posta",
    description:
      "Panele erişemiyorsanız veya satış öncesi bir sorunuz varsa doğrudan destek ekibimize yazın.",
    note: "support@kleacore.com",
    action: { label: "E-posta gönder", href: "mailto:support@kleacore.com" },
    external: true,
  },
  {
    icon: BookOpen,
    title: "Bilgi bankası",
    description:
      "Hosting, alan adı, DNS, SSL ve e-posta için adım adım rehberler. Çoğu sorunun yanıtı burada.",
    note: "Rehberler ve çözümler",
    action: { label: "Bilgi bankasına git", href: "/bilgi-bankasi" },
    external: false,
  },
] as const;

const faqs: FaqItem[] = [
  {
    question: "Destek talebini nasıl oluştururum?",
    answer:
      "Müşteri panelinize giriş yapın, Destek bölümünden “Yeni talep” seçin. Konuyu, ilgili hizmeti ve sorunun ayrıntılarını yazmanız talebin daha hızlı çözülmesine yardımcı olur.",
  },
  {
    question: "Müşteri paneline giriş yapamıyorum, ne yapmalıyım?",
    answer:
      "Giriş sayfasındaki “Şifremi unuttum” bağlantısıyla şifrenizi sıfırlayabilirsiniz. Sorun devam ederse kayıtlı e-posta adresinizden support@kleacore.com adresine yazın.",
  },
  {
    question: "Bir kesinti olup olmadığını nasıl öğrenirim?",
    answer:
      "Devam eden olaylar ve bakım çalışmaları Sistem Durumu sayfasında duyurulur. Orada listelenmeyen bir sorun yaşıyorsanız destek talebi oluşturun.",
  },
  {
    question: "Hosting paketimi nasıl yükseltebilirim?",
    answer:
      "Müşteri panelinizden ilgili hizmet için destek talebi oluşturabilirsiniz; paket yükseltme işleminiz destek ekibimiz tarafından yapılır.",
  },
];

export function DestekContent({ categories, searchIndex, popularArticles }: DestekContentProps) {
  return (
    <SiteShell>
      <PageHeader
        eyebrow="7/24 destek"
        title="Destek Merkezi"
        description="Size nasıl yardımcı olabiliriz? Bilgi bankasında arayın veya destek ekibimize ulaşın."
        breadcrumbs={[{ label: "Destek Merkezi" }]}
      >
        {searchIndex.length > 0 ? <KbSearch items={searchIndex} /> : null}
      </PageHeader>

      <Section aria-labelledby="iletisim-kanallari">
        <SectionHeading
          id="iletisim-kanallari"
          eyebrow="Bize ulaşın"
          title="Destek kanalları"
          className="mb-10"
        />
        <ul className="grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <li key={channel.title} className="flex flex-col bg-background p-6 md:p-8">
                <span className="flex size-10 items-center justify-center rounded-lg border bg-muted/40">
                  <Icon aria-hidden className="size-5 text-foreground/80" />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{channel.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {channel.description}
                </p>
                <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {channel.note}
                </p>
                {channel.external ? (
                  <a
                    href={channel.action.href}
                    className="group mt-4 inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {channel.action.label}
                    <ArrowUpRight aria-hidden className="size-4 text-muted-foreground group-hover:text-foreground" />
                  </a>
                ) : (
                  <Link
                    href={channel.action.href}
                    className="group mt-4 inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {channel.action.label}
                    <ArrowUpRight aria-hidden className="size-4 text-muted-foreground group-hover:text-foreground" />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
        <Link
          href="/musteri/durum"
          className="group mt-4 flex min-h-14 items-center gap-3 rounded-xl border px-5 py-3 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Activity aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="font-medium">Bir kesinti mi var?</span>{" "}
            <span className="text-muted-foreground">
              Devam eden olayları ve bakım duyurularını sistem durumu sayfasında görün.
            </span>
          </span>
          <ArrowUpRight
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
          />
        </Link>
      </Section>

      {categories.length > 0 ? (
        <Section tone="muted" divider aria-labelledby="yardim-kategorileri">
          <SectionHeading
            id="yardim-kategorileri"
            eyebrow="Bilgi bankası"
            title="Yardım kategorileri"
            description="Konuya göre rehberlere göz atın."
            actions={
              <Link
                href="/bilgi-bankasi"
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Tüm bilgi bankası
                <ArrowUpRight aria-hidden className="size-4" />
              </Link>
            }
            className="mb-10"
          />
          <ul className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => {
              const Icon = kbIcon(category.icon);
              return (
                <li key={category.id} className="bg-background">
                  <Link
                    href={`/bilgi-bankasi/${category.slug}`}
                    className="group flex h-full items-start gap-4 p-6 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 transition-colors group-hover:bg-background">
                      <Icon aria-hidden className="size-5 text-foreground/80" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-base font-medium tracking-tight">{category.name}</span>
                        <ArrowUpRight
                          aria-hidden
                          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
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
        </Section>
      ) : null}

      {popularArticles.length > 0 ? (
        <Section divider aria-labelledby="populer-makaleler">
          <SectionHeading
            id="populer-makaleler"
            eyebrow="En çok okunanlar"
            title="Popüler makaleler"
            className="mb-8"
          />
          <ul className="grid md:grid-cols-2 md:gap-x-10">
            {popularArticles.map((article) => (
              <li key={article.id} className="border-b">
                <Link
                  href={`/bilgi-bankasi/${article.categorySlug}/${article.slug}`}
                  className="group flex min-h-16 items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug group-hover:underline group-hover:underline-offset-4">
                      {article.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{article.categoryName}</span>
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <FaqSection
        items={faqs}
        eyebrow="SSS"
        title="Destek hakkında sık sorulanlar"
        divider
      />

      <CtaBand
        eyebrow="Destek"
        title="Hâlâ yardıma mı ihtiyacınız var?"
        description="Destek ekibimiz yardımcı olmak için hazır. Müşteri panelinden talep oluşturun veya bize yazın."
        primary={{ label: "Destek talebi oluştur", href: "/musteri/panel/destek/yeni" }}
        secondary={{ label: "İletişim", href: "/iletisim" }}
        aside={
          <div className="flex h-full flex-col justify-center gap-4 text-sm">
            <Eyebrow>E-posta</Eyebrow>
            <p className="leading-relaxed text-muted-foreground">Panele erişemiyorsanız kayıtlı e-posta adresinizden yazabilirsiniz.</p>
            <a
              href="mailto:support@kleacore.com"
              className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              support@kleacore.com
            </a>
          </div>
        }
      />
    </SiteShell>
  );
}
