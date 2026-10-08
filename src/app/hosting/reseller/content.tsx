import { Clock, Lock, MapPin, Monitor, Tag, Users } from "lucide-react";
import { FeatureGrid, type FeatureItem } from "@/components/site/feature-grid";
import type { FaqItem } from "@/components/site/faq-section";
import type { PlanCardData } from "@/components/site/plan-card";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import type { TrustBarItem } from "@/components/site/trust-bar";
import type { HostingComparisonData, HostingSubType } from "@/components/site/hosting/data";
import { HostingLanding } from "@/components/site/hosting/hosting-landing";
import {
  ResellerCalculator,
  type ResellerCalcPlan,
} from "@/components/site/hosting/reseller-calculator";
import { ResellerTree } from "@/components/site/hosting/visuals";

const trustItems: TrustBarItem[] = [
  { icon: Monitor, label: "WHM panel", description: "Bayi yönetim paneli" },
  { icon: Users, label: "cPanel hesapları", description: "Müşterileriniz için" },
  { icon: Tag, label: "White label", description: "Kendi markanızla" },
  { icon: Lock, label: "Ücretsiz SSL", description: "Let's Encrypt" },
  { icon: Clock, label: "Günlük yedek", description: "Tüm reseller paketlerinde" },
  { icon: MapPin, label: "İstanbul", description: "Sunucu lokasyonu" },
];

const resellerFeatures: FeatureItem[] = [
  {
    icon: "Monitor",
    title: "WHM ile hesap yönetimi",
    description:
      "WHM üzerinden müşterileriniz için cPanel hesapları açın, askıya alın veya kapatın; DNS kayıtlarını yönetin.",
  },
  {
    icon: "Users",
    title: "Kendi paketlerinizi tanımlayın",
    description:
      "Toplam disk ve trafik kotanızı dilediğiniz gibi bölün; farklı kaynaklarla kendi hosting paketlerinizi oluşturun.",
  },
  {
    icon: "Tag",
    title: "White label",
    description:
      "Hizmeti kendi markanızla sunun. Müşterileriniz sizinle muhatap olur; fiyatlarınızı ve kampanyalarınızı siz belirlersiniz.",
  },
  {
    icon: "Download",
    title: "Günlük yedek",
    description:
      "Tüm reseller paketlerinde yedekler günlük alınır; müşteri hesaplarınız da bu kapsamdadır.",
  },
];

const faqs: FaqItem[] = [
  {
    question: "Reseller hosting nedir?",
    answer:
      "Reseller hosting, satın aldığınız hosting kaynaklarını kendi müşterilerinize satmanızı sağlayan bir hizmettir. WHM kontrol paneliyle cPanel hesapları oluşturur, kendi hosting hizmetinizi sunarsınız.",
  },
  {
    question: "WHM paneli nedir?",
    answer:
      "WHM (Web Host Manager), reseller hesabınızı yönettiğiniz paneldir. cPanel hesapları oluşturabilir, paketler tanımlayabilir ve DNS yönetimi yapabilirsiniz.",
  },
  {
    question: "White label ne anlama geliyor?",
    answer:
      "White label, hosting hizmetini kendi markanız altında satmanızı sağlar. Müşterilerinizle iletişim sizin markanız üzerinden yürür.",
  },
  {
    question: "Müşterilerime ne kadar kaynak verebilirim?",
    answer:
      "Paketinizin cPanel hesap limiti, disk alanı ve trafik kotası dahilinde kaynakları dilediğiniz gibi dağıtabilirsiniz. WHM'de farklı paketler oluşturup müşterilerinize atarsınız.",
  },
  {
    question: "Kendi fiyatlarımı belirleyebilir miyim?",
    answer:
      "Evet. Müşterilerinize sunacağınız fiyatları tamamen siz belirlersiniz. Sayfadaki hesaplayıcıyla kendi fiyatınıza göre örnek bir aylık hesap yapabilirsiniz.",
  },
  {
    question: "Teknik destek müşterilerime de veriliyor mu?",
    answer:
      "Teknik destek doğrudan size verilir. Müşterilerinize destek vermek sizin sorumluluğunuzdadır; sunucu seviyesindeki sorunlarda size yardımcı oluruz.",
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
  calcPlans,
  startingPrices,
}: {
  plans: PlanCardData[];
  comparison: HostingComparisonData;
  calcPlans: ResellerCalcPlan[];
  startingPrices: Partial<Record<HostingSubType, number>>;
}) {
  return (
    <HostingLanding
      subType="reseller"
      hero={{
        eyebrow: "WHM · White label",
        title: "Reseller Hosting",
        description:
          "Kendi hosting markanızı kurun. WHM ile müşterilerinize cPanel hesapları açın, paketlerinizi tanımlayın ve fiyatınızı siz belirleyin.",
        breadcrumb: "Reseller Hosting",
      }}
      trustItems={trustItems}
      plans={plans}
      comparison={comparison}
      plansHeading={{
        eyebrow: "Reseller hosting",
        title: "Bayi paketleri",
        description:
          "Tüm paketlerde WHM, white label, ücretsiz SSL ve günlük yedek var. Paketler cPanel hesap sayısı, disk, trafik ve kaynaklarla ayrılır.",
      }}
      steps={{
        eyebrow: "Nasıl çalışır",
        title: "Bayiliğe dört adımda başlayın",
        items: [
          {
            title: "Bayi paketinizi seçin",
            description: "Kaç müşteriye hizmet vereceğinize göre cPanel hesap limitine uygun paketi seçin.",
          },
          {
            title: "WHM'e giriş yapın",
            description: "Hizmetiniz açıldığında WHM paneliniz üzerinden hesabınızı yönetmeye başlayın.",
          },
          {
            title: "Paketlerinizi tanımlayın",
            description: "Disk ve trafik kotalarını bölerek müşterilerinize sunacağınız paketleri oluşturun.",
          },
          {
            title: "Müşteri hesaplarını açın",
            description: "Her müşteriniz için cPanel hesabı oluşturun ve kendi markanızla faturalandırın.",
          },
        ],
      }}
      startingPrices={startingPrices}
      faqs={faqs}
      faqDescription="Reseller hosting ve WHM hakkında sık sorulan sorular."
      cta={{
        eyebrow: "Bayilik",
        title: "Kendi hosting markanızı bugün kurun",
        description: "WHM ve white label ile müşterilerinize kendi markanızla hosting sunun.",
        primary: { label: "Paketleri incele", href: "#paketler" },
        secondary: { label: "Bize yazın", href: "/iletisim" },
      }}
    >
      <Section divider aria-labelledby="whm-heading">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading
              id="whm-heading"
              eyebrow="WHM"
              title="Altyapı bizde, müşteri ilişkisi sizde"
              description="Sunucu, ağ ve yedekleme tarafını biz yönetiriz. Siz WHM üzerinden müşterilerinizin hesaplarını açar ve yönetirsiniz."
              className="mb-10"
            />
            <FeatureGrid items={resellerFeatures} columns={2} variant="inline" />
          </div>
          <ResellerTree />
        </div>
      </Section>

      {calcPlans.length > 0 ? (
        <Section divider aria-labelledby="hesap-heading">
          <SectionHeading
            id="hesap-heading"
            eyebrow="Örnek hesap"
            title="Kendi fiyatınızla hesaplayın"
            description="Bir paket seçin, müşteri sayısını ve müşteri başına aylık fiyatınızı girin. Paket bedelleri güncel fiyatlarımızdan gelir."
            className="mb-10"
          />
          <ResellerCalculator plans={calcPlans} />
        </Section>
      ) : null}
    </HostingLanding>
  );
}
