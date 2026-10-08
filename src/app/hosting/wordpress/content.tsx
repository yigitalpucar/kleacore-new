import { Clock, Copy, Lock, MapPin, PanelsTopLeft, Rocket } from "lucide-react";
import { FeatureGrid, type FeatureItem } from "@/components/site/feature-grid";
import type { FaqItem } from "@/components/site/faq-section";
import type { PlanCardData } from "@/components/site/plan-card";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import type { TrustBarItem } from "@/components/site/trust-bar";
import type { HostingComparisonData, HostingSubType } from "@/components/site/hosting/data";
import { HostingLanding } from "@/components/site/hosting/hosting-landing";
import { WpStagingPanel } from "@/components/site/hosting/visuals";

const trustItems: TrustBarItem[] = [
  { icon: Rocket, label: "LiteSpeed Cache", description: "Tüm WP paketlerinde" },
  { icon: Copy, label: "WP Staging", description: "Test ortamı" },
  { icon: Clock, label: "Günlük yedek", description: "Tüm WP paketlerinde" },
  { icon: Lock, label: "Ücretsiz SSL", description: "Let's Encrypt / Wildcard" },
  { icon: PanelsTopLeft, label: "cPanel", description: "Kontrol paneli" },
  { icon: MapPin, label: "İstanbul", description: "Sunucu lokasyonu" },
];

const wpFeatures: FeatureItem[] = [
  {
    icon: "Rocket",
    title: "LiteSpeed Cache",
    description:
      "WordPress için geliştirilmiş LiteSpeed Cache eklentisiyle sayfa önbellekleme, CSS/JS küçültme ve görsel optimizasyonu ayarlarını tek yerden yapın.",
  },
  {
    icon: "CircleDot",
    title: "WP Staging",
    description:
      "Canlı sitenizin bir kopyasında tema, eklenti ve içerik değişikliklerini deneyin; sorun yoksa canlıya aktarın.",
  },
  {
    icon: "Download",
    title: "Günlük otomatik yedek",
    description:
      "Tüm WordPress paketlerinde yedekler günlük alınır. Bir güncelleme ters giderse önceki güne dönebilirsiniz.",
  },
  {
    icon: "Lock",
    title: "Ücretsiz SSL",
    description:
      "Let's Encrypt SSL tüm paketlerde ücretsizdir; üst pakette alt alan adlarınızı da kapsayan Wildcard SSL dahildir.",
  },
];

const faqs: FaqItem[] = [
  {
    question: "WordPress hosting ile Linux hosting arasındaki fark nedir?",
    answer:
      "İkisi de cPanel ile yönetilir. WordPress paketlerinde LiteSpeed Cache ve WP Staging hazır gelir, yedekler tüm paketlerde günlük alınır ve paketler WordPress sitelerinin ihtiyaç duyduğu disk ve RAM miktarlarına göre ayrılır.",
  },
  {
    question: "WordPress'i nasıl kurarım?",
    answer:
      "Hizmetiniz açıldıktan sonra WordPress'i cPanel üzerinden kurabilir veya mevcut sitenizi taşıyabilirsiniz. Takıldığınız bir adım olursa destek ekibimize yazabilirsiniz.",
  },
  {
    question: "WP Staging nedir?",
    answer:
      "WP Staging, canlı sitenizin bir kopyasını oluşturarak değişikliklerinizi test etmenizi sağlar. Tema, eklenti veya içerik değişikliklerini önce test ortamında dener, sorun yoksa canlıya alırsınız.",
  },
  {
    question: "LiteSpeed Cache nedir?",
    answer:
      "LiteSpeed Cache, LiteSpeed web sunucusuyla birlikte çalışan bir WordPress önbellekleme eklentisidir. Sayfa önbellekleme, görsel optimizasyonu, CSS/JS küçültme ve veritabanı temizliği gibi ayarlar sunar.",
  },
  {
    question: "WooCommerce mağazası için hangi paketi seçmeliyim?",
    answer:
      "Ürün sayısı, görsel boyutu ve ziyaretçi sayısı ihtiyacı belirler. Mağazalar için genellikle daha fazla CPU, RAM ve disk sunan üst paketler daha uygundur; karşılaştırma tablosundan kaynakları inceleyebilirsiniz.",
  },
  {
    question: "Aylık mı, yıllık mı ödeme yapabilirim?",
    answer:
      "İkisi de mümkün. Yıllık ödemede aylık karşılık daha düşüktür; fark paket kartlarında gösterilir. Fiyatlara KDV dahil değildir, %20 KDV ödeme adımında eklenir.",
  },
  {
    question: "Nasıl destek alırım?",
    answer:
      "Müşteri panelinden 7/24 destek talebi açabilir veya support@kleacore.com adresine e-posta gönderebilirsiniz.",
  },
];

export function Content({
  plans,
  comparison,
  startingPrices,
}: {
  plans: PlanCardData[];
  comparison: HostingComparisonData;
  startingPrices: Partial<Record<HostingSubType, number>>;
}) {
  return (
    <HostingLanding
      subType="wordpress"
      hero={{
        eyebrow: "LiteSpeed Cache · WP Staging",
        title: "WordPress Hosting",
        description:
          "Blogunuz, kurumsal siteniz veya WooCommerce mağazanız için LiteSpeed Cache ve WP Staging hazır, yedekleri her gün alınan WordPress paketleri.",
        breadcrumb: "WordPress Hosting",
      }}
      trustItems={trustItems}
      plans={plans}
      comparison={comparison}
      plansHeading={{
        eyebrow: "WordPress hosting",
        title: "WordPress paketleri",
        description:
          "Tüm paketlerde LiteSpeed Cache, WP Staging, günlük yedek ve ücretsiz SSL var. Paketler site sayısı, disk ve kaynaklarla ayrılır.",
      }}
      steps={{
        title: "WordPress sitenizi yayına alın",
        items: [
          {
            title: "Paketinizi seçin",
            description: "Site sayısına ve trafiğinize uyan WordPress paketini seçin.",
          },
          {
            title: "Alan adını bağlayın",
            description: "Yeni alan adı kaydedin veya mevcut alan adınızı kullanın.",
          },
          {
            title: "WordPress'i kurun",
            description: "cPanel üzerinden WordPress'i kurun veya mevcut sitenizi taşıyın.",
          },
          {
            title: "Önbelleği açın",
            description: "LiteSpeed Cache eklentisini etkinleştirin; değişiklikleri önce staging'de deneyin.",
          },
        ],
      }}
      startingPrices={startingPrices}
      faqs={faqs}
      faqDescription="WordPress hosting paketleri hakkında sık sorulan sorular."
      cta={{
        eyebrow: "WordPress",
        title: "WordPress sitenizi güvenle büyütün",
        description: "LiteSpeed Cache, WP Staging ve günlük yedekle başlayın; paketinizi ihtiyacınız arttıkça değiştirin.",
        primary: { label: "Paketleri incele", href: "#paketler" },
        secondary: { label: "Alan adı sorgula", href: "/domain/kayit" },
      }}
    >
      <Section divider aria-labelledby="wp-heading">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <WpStagingPanel className="order-last lg:order-first" />
          <div>
            <SectionHeading
              id="wp-heading"
              eyebrow="WordPress'e özel"
              title="Güncellemeden önce test edin, hızı ayarlayın"
              description="WordPress paketleri, sitenizi bozmadan değişiklik yapmanız ve sayfalarınızı hızlı sunmanız için gereken araçlarla gelir."
              className="mb-10"
            />
            <FeatureGrid items={wpFeatures} columns={2} variant="inline" />
          </div>
        </div>
      </Section>
    </HostingLanding>
  );
}
