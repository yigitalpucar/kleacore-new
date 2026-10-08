import { Clock, HardDrive, Lock, Mail, MapPin, PanelsTopLeft } from "lucide-react";
import { FeatureGrid, type FeatureItem } from "@/components/site/feature-grid";
import type { FaqItem } from "@/components/site/faq-section";
import type { PlanCardData } from "@/components/site/plan-card";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import type { TrustBarItem } from "@/components/site/trust-bar";
import type {
  HostingComparisonData,
  HostingResourceRow,
  HostingSubType,
} from "@/components/site/hosting/data";
import { HostingLanding } from "@/components/site/hosting/hosting-landing";
import { ResourceBars } from "@/components/site/hosting/resource-bars";
import { BusinessPanel } from "@/components/site/hosting/visuals";

const trustItems: TrustBarItem[] = [
  { icon: HardDrive, label: "NVMe SSD", description: "Tüm kurumsal paketlerde" },
  { icon: Lock, label: "Wildcard SSL", description: "Alt alan adları dahil" },
  { icon: Clock, label: "Günlük yedek", description: "Otomatik" },
  { icon: Mail, label: "Kurumsal e-posta", description: "Alan adınızla" },
  { icon: PanelsTopLeft, label: "cPanel", description: "Kontrol paneli" },
  { icon: MapPin, label: "İstanbul", description: "Sunucu lokasyonu" },
];

const businessFeatures: FeatureItem[] = [
  {
    icon: "Mail",
    title: "Kurumsal e-posta",
    description:
      "Ekibiniz için ad@firmaniz.com biçiminde e-posta hesapları açın. Hesap sayısı pakete göre değişir.",
  },
  {
    icon: "Lock",
    title: "Wildcard SSL",
    description:
      "Tek sertifika ana alan adınızı ve tüm alt alan adlarınızı (www, blog, magaza…) korur; tüm kurumsal paketlerde dahildir.",
  },
  {
    icon: "Download",
    title: "Günlük otomatik yedek",
    description: "Siteleriniz, veritabanlarınız ve e-postalarınız her gün otomatik olarak yedeklenir.",
  },
  {
    icon: "Globe",
    title: "Birden çok site",
    description:
      "Kurumsal site, kampanya sayfaları ve alt markalarınızı tek hesapta barındırın; site sayısı pakete göre artar.",
  },
  {
    icon: "Cpu",
    title: "Daha yüksek kaynak",
    description:
      "Kurumsal paketler Linux hosting paketlerine göre daha fazla CPU ve RAM sunar; üst paketlerde kaynaklar artar.",
  },
  {
    icon: "Headphones",
    title: "7/24 destek",
    description: "Müşteri panelinden destek talebi açın veya support@kleacore.com adresine yazın.",
  },
];

const faqs: FaqItem[] = [
  {
    question: "Kurumsal hosting ile Linux hosting arasındaki fark nedir?",
    answer:
      "Kurumsal paketler daha fazla CPU, RAM, disk ve e-posta hesabı sunar; tüm paketlerde NVMe SSD, Wildcard SSL ve günlük yedekleme bulunur. Birden çok siteyi ve ekip e-postalarını tek hesapta toplamak isteyen işletmeler için tasarlanmıştır.",
  },
  {
    question: "Wildcard SSL sertifikası nedir?",
    answer:
      "Wildcard SSL, ana alan adınızı ve tüm alt alan adlarınızı tek sertifikayla korur. Örneğin firmaniz.com, www.firmaniz.com ve blog.firmaniz.com aynı sertifikayla HTTPS üzerinden açılır.",
  },
  {
    question: "Kurumsal e-posta hesaplarını nasıl kullanırım?",
    answer:
      "E-posta hesaplarınızı cPanel üzerinden oluşturursunuz. Webmail ile tarayıcıdan veya IMAP/SMTP ayarlarıyla Outlook, Apple Mail ve mobil uygulamalardan kullanabilirsiniz.",
  },
  {
    question: "Sunucular nerede?",
    answer: "Sunucularımız İstanbul lokasyonunda barındırılır.",
  },
  {
    question: "Kaynaklarımı yükseltebilir miyim?",
    answer:
      "Evet. İşletmeniz büyüdükçe müşteri panelinden paket değişikliği talebi oluşturabilirsiniz; talebiniz ekibimiz tarafından değerlendirilir.",
  },
  {
    question: "Fiyatlara KDV dahil mi?",
    answer:
      "Hayır. Gösterilen fiyatlara KDV dahil değildir; %20 KDV ödeme adımında ayrıca eklenir ve sipariş özetinde gösterilir.",
  },
];

export function Content({
  plans,
  comparison,
  resources,
  startingPrices,
}: {
  plans: PlanCardData[];
  comparison: HostingComparisonData;
  resources: HostingResourceRow[];
  startingPrices: Partial<Record<HostingSubType, number>>;
}) {
  return (
    <HostingLanding
      subType="kurumsal"
      hero={{
        eyebrow: "İşletmeler için",
        title: "Kurumsal Hosting",
        description:
          "Şirket siteniz, kurumsal e-postalarınız ve alt markalarınız tek hesapta. NVMe SSD, Wildcard SSL ve günlük yedekle daha yüksek kaynaklı paketler.",
        breadcrumb: "Kurumsal Hosting",
      }}
      trustItems={trustItems}
      plans={plans}
      comparison={comparison}
      plansHeading={{
        eyebrow: "Kurumsal hosting",
        title: "Kurumsal paketler",
        description:
          "Tüm paketlerde NVMe SSD, Wildcard SSL, günlük yedek ve cPanel var. Paketler site, e-posta ve CPU/RAM miktarıyla ayrılır.",
      }}
      steps={{
        title: "Firmanızı taşıyın, ekibinizi bağlayın",
        items: [
          {
            title: "Paketinizi seçin",
            description: "Site, e-posta ve kaynak ihtiyacınıza göre kurumsal paketi seçin.",
          },
          {
            title: "Alan adınızı bağlayın",
            description: "Mevcut alan adınızı kullanın veya yeni bir alan adı kaydedin.",
          },
          {
            title: "E-postaları oluşturun",
            description: "cPanel'den ekibiniz için kurumsal e-posta hesaplarını açın.",
          },
          {
            title: "Sitelerinizi yayınlayın",
            description: "Dosyalarınızı yükleyin; SSL ve günlük yedek otomatik olarak çalışır.",
          },
        ],
      }}
      startingPrices={startingPrices}
      faqs={faqs}
      faqDescription="Kurumsal hosting paketleri hakkında sık sorulan sorular."
      cta={{
        eyebrow: "Kurumsal",
        title: "İşletmenizin web altyapısını tek yerde toplayın",
        description: "Kurumsal siteniz, e-postalarınız ve yedekleriniz için doğru paketi seçin.",
        primary: { label: "Paketleri incele", href: "#paketler" },
        secondary: { label: "Bize yazın", href: "/iletisim" },
      }}
    >
      <Section divider aria-labelledby="kurumsal-heading">
        <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <SectionHeading
              id="kurumsal-heading"
              eyebrow="İşletmeler için"
              title="Kurumsal ihtiyaçlar pakete dahil"
              description="Ayrı ayrı satın almanız gereken SSL, yedek ve e-posta gibi hizmetler kurumsal paketlerde hazır gelir."
              className="mb-10"
            />
            <FeatureGrid items={businessFeatures} columns={2} variant="inline" />
          </div>
          <BusinessPanel className="lg:mt-24" />
        </div>
      </Section>

      <Section divider aria-labelledby="kaynak-heading">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <SectionHeading
            id="kaynak-heading"
            eyebrow="Kaynaklar"
            title="Büyüdükçe kaynağınız da büyüsün"
            description="Paketler arasındaki CPU, RAM ve disk farkını bir bakışta görün. İhtiyacınız arttığında üst pakete geçmek için müşteri panelinden talep oluşturabilirsiniz."
          />
          <ResourceBars rows={resources} title="kurumsal / kaynaklar" />
        </div>
      </Section>
    </HostingLanding>
  );
}
