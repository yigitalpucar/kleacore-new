import { Clock, Gauge, HardDrive, Lock, MapPin, PanelsTopLeft } from "lucide-react";
import { FeatureGrid, type FeatureItem } from "@/components/site/feature-grid";
import type { FaqItem } from "@/components/site/faq-section";
import type { PlanCardData } from "@/components/site/plan-card";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import type { TrustBarItem } from "@/components/site/trust-bar";
import type {
  HostingComparisonData,
  HostingSubType,
} from "@/components/site/hosting/data";
import { HostingLanding } from "@/components/site/hosting/hosting-landing";
import { CpanelPanel } from "@/components/site/hosting/visuals";

const trustItems: TrustBarItem[] = [
  { icon: HardDrive, label: "SSD disk", description: "Tüm paketlerde" },
  { icon: Gauge, label: "LiteSpeed", description: "Web sunucu yazılımı" },
  { icon: PanelsTopLeft, label: "cPanel", description: "Kontrol paneli" },
  { icon: Lock, label: "Ücretsiz SSL", description: "Let's Encrypt" },
  { icon: Clock, label: "Otomatik yedek", description: "Pakete göre haftalık/günlük" },
  { icon: MapPin, label: "İstanbul", description: "Sunucu lokasyonu" },
];

const cpanelFeatures: FeatureItem[] = [
  {
    icon: "Globe",
    title: "Siteniz ve alt alan adlarınız",
    description: "Alan adınızı bağlayın, alt alan adları açın; dosyalarınızı Dosya Yöneticisi veya FTP ile yükleyin.",
  },
  {
    icon: "Mail",
    title: "Alan adınızla e-posta",
    description: "ad@alanadiniz.com biçiminde e-posta hesapları oluşturun. Hesap sayısı pakete göre değişir.",
  },
  {
    icon: "Database",
    title: "MySQL veritabanı",
    description: "PHP ve MySQL ile çalışan uygulamalar için veritabanı oluşturun ve yönetin.",
  },
  {
    icon: "Lock",
    title: "Ücretsiz SSL",
    description: "Let's Encrypt SSL sertifikası tüm paketlerde ücretsizdir; siteniz HTTPS ile açılır.",
  },
];

const faqs: FaqItem[] = [
  {
    question: "Linux hosting nedir?",
    answer:
      "Linux hosting, web sitenizin Linux işletim sistemli sunucularda barındırılmasıdır. PHP ve MySQL ile çalışan siteler ve WordPress gibi yaygın uygulamalar için uygundur.",
  },
  {
    question: "Hangi kontrol paneli kullanılıyor?",
    answer:
      "Tüm Linux hosting paketlerinde cPanel kullanılır. Dosyalarınızı, e-posta hesaplarınızı, veritabanlarınızı ve SSL ayarlarınızı cPanel üzerinden yönetirsiniz.",
  },
  {
    question: "SSL sertifikası ücretsiz mi?",
    answer:
      "Evet. Tüm hosting paketlerinde Let's Encrypt SSL sertifikası ücretsizdir. Alt alan adlarını tek sertifikayla korumak isterseniz satın alma adımında Wildcard SSL ek hizmetini seçebilirsiniz.",
  },
  {
    question: "Yedekleme ne sıklıkla yapılıyor?",
    answer:
      "Yedekleme sıklığı pakete göre değişir ve paket kartlarında yazar: giriş paketlerinde haftalık, üst pakette günlük. Haftalık yedekli paketlere satın alma adımında Günlük Yedekleme ek hizmetini ekleyebilirsiniz.",
  },
  {
    question: "Aylık mı, yıllık mı ödeme yapabilirim?",
    answer:
      "İkisi de mümkün. Yıllık ödemede aylık karşılık daha düşüktür; fark paket kartlarında ve karşılaştırma tablosunda gösterilir.",
  },
  {
    question: "Fiyatlara KDV dahil mi?",
    answer:
      "Hayır. Gösterilen fiyatlara KDV dahil değildir; %20 KDV ödeme adımında ayrıca eklenir ve sipariş özetinde gösterilir.",
  },
  {
    question: "Paketimi daha sonra yükseltebilir miyim?",
    answer:
      "Evet. Müşteri panelinden paket değişikliği talebi oluşturabilirsiniz; talebiniz ekibimiz tarafından değerlendirilir.",
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
      subType="linux"
      hero={{
        eyebrow: "cPanel · LiteSpeed",
        title: "Linux Hosting",
        description:
          "Kişisel siteniz, blogunuz veya küçük işletme siteniz için cPanel ve LiteSpeed web sunucu ile çalışan, ücretsiz SSL'li hosting paketleri.",
        breadcrumb: "Linux Hosting",
      }}
      trustItems={trustItems}
      plans={plans}
      comparison={comparison}
      plansHeading={{
        eyebrow: "Linux hosting",
        title: "Paketinizi seçin",
        description:
          "Tüm paketlerde cPanel, LiteSpeed ve ücretsiz Let's Encrypt SSL var. Paketler disk, trafik, e-posta ve kaynak miktarıyla ayrılır.",
      }}
      steps={{
        title: "Dört adımda yayına alın",
        description: "Sipariş adımları paketin satın alma sayfasında sırayla ilerler.",
        items: [
          {
            title: "Paketinizi seçin",
            description: "Disk, trafik ve e-posta ihtiyacınıza uyan paketi seçin; aylık veya yıllık ödemeye karar verin.",
          },
          {
            title: "Alan adını belirleyin",
            description: "Yeni bir alan adı kaydedin, sahip olduğunuz alan adını bağlayın veya bu adımı sonraya bırakın.",
          },
          {
            title: "Ek hizmetleri ekleyin",
            description: "İsterseniz günlük yedekleme, Wildcard SSL veya özel IP gibi ek hizmetleri seçin.",
          },
          {
            title: "Ödeyin ve yönetin",
            description: "Kredi kartı veya banka havalesiyle ödeyin; hizmetinizi müşteri panelinizden takip edin.",
          },
        ],
      }}
      startingPrices={startingPrices}
      faqs={faqs}
      faqDescription="Linux hosting paketleri hakkında sık sorulan sorular."
      cta={{
        eyebrow: "Başlayın",
        title: "Sitenizi bugün yayına alın",
        description: "Paketinizi seçin, alan adınızı ekleyin; cPanel, LiteSpeed ve ücretsiz SSL ile hemen başlayın.",
        primary: { label: "Paketleri incele", href: "#paketler" },
        secondary: { label: "Alan adı sorgula", href: "/domain/kayit" },
      }}
    >
      <Section divider aria-labelledby="cpanel-heading">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading
              id="cpanel-heading"
              eyebrow="cPanel"
              title="Sitenizi tek panelden yönetin"
              description="Dosya, e-posta, veritabanı ve SSL işlemleri için ayrı araçlara gerek yok. Hepsi alışık olduğunuz cPanel arayüzünde."
              className="mb-10"
            />
            <FeatureGrid items={cpanelFeatures} columns={2} variant="inline" />
          </div>
          <CpanelPanel />
        </div>
      </Section>
    </HostingLanding>
  );
}
