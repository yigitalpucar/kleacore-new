import type { Metadata } from "next";
import {
  Archive,
  Code2,
  Gauge,
  Headphones,
  Lock,
  MapPin,
  PanelsTopLeft,
  Receipt,
} from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HomeHero, type StartingPrice } from "@/components/sections/home-hero";
import { HostingSolutions } from "@/components/sections/hosting-solutions";
import { DomainSearchSection } from "@/components/sections/domain-search-section";
import { CtaBand } from "@/components/site/cta-band";
import { FaqSection, type FaqItem } from "@/components/site/faq-section";
import { FeatureGrid, type FeatureItem } from "@/components/site/feature-grid";
import { InfraStack } from "@/components/site/infra-stack";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { TrustBar } from "@/components/site/trust-bar";
import { getProductsBySubType } from "@/lib/dal/products";
import { getDomainTlds } from "@/lib/dal/domain-tlds";
import { productToPlanCard, productToServerRow } from "@/lib/products/map-product";
import { toNumber } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "KLEACORE | Alan Adı, Hosting ve VDS Sunucu" },
  description:
    "Alan adı kaydı, cPanel ve LiteSpeed ile Linux hosting, NVMe SSD diskli VDS sunucu ve SSL sertifikaları. İstanbul lokasyon, ücretsiz Let's Encrypt SSL, 7/24 destek.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "KLEACORE | Alan Adı, Hosting ve VDS Sunucu",
    description:
      "cPanel ve LiteSpeed ile Linux hosting, NVMe SSD diskli VDS sunucu, alan adı ve SSL. Fiyatlar KDV hariç, açıkça listelenir.",
    url: "/",
  },
};

const whyItems: FeatureItem[] = [
  {
    icon: Gauge,
    title: "LiteSpeed ve NVMe SSD",
    description: "Hosting paketleri LiteSpeed web sunucu üzerinde, VDS sunucular NVMe SSD diskler üzerinde çalışır.",
  },
  {
    icon: PanelsTopLeft,
    title: "cPanel ile kolay yönetim",
    description: "Dosya, e-posta, veritabanı ve DNS ayarlarınızı alışık olduğunuz cPanel arayüzünden yönetin.",
  },
  {
    icon: Lock,
    title: "Ücretsiz SSL",
    description: "Hosting paketlerinde Let's Encrypt SSL ücretsizdir; kurumsal ihtiyaçlar için ücretli sertifikalar da var.",
  },
  {
    icon: Archive,
    title: "Otomatik yedekleme",
    description: "Hosting paketinize göre haftalık veya günlük otomatik yedek alınır.",
  },
  {
    icon: MapPin,
    title: "İstanbul lokasyon",
    description: "Sunucular İstanbul'da barındırılır; Türkiye'deki ziyaretçilerinize yakın konum.",
  },
  {
    icon: Receipt,
    title: "Açık fiyatlandırma",
    description: "Fiyatlar KDV hariç listelenir; %20 KDV ödeme adımında ayrıca gösterilir. Yıllık ödemenin farkı kartlarda yazar.",
  },
  {
    icon: Code2,
    title: "Müşteri paneli ve API",
    description: "Hizmet, fatura ve destek işlemlerinizi tek panelden yönetin; REST API ile otomasyon kurun.",
  },
  {
    icon: Headphones,
    title: "7/24 destek",
    description: "Müşteri panelinden destek talebi açın veya support@kleacore.com adresine yazın.",
  },
];

const homeFaqs: FaqItem[] = [
  {
    question: "Fiyatlara KDV dahil mi?",
    answer:
      "Hayır. Sitede gösterilen tüm fiyatlara KDV dahil değildir; %20 KDV ödeme adımında ayrıca eklenir ve sipariş özetinde gösterilir.",
  },
  {
    question: "Aylık mı, yıllık mı ödeme yapabilirim?",
    answer:
      "Hosting ve sunucu paketlerinde aylık veya yıllık ödeme seçebilirsiniz. Yıllık ödemede aylık karşılık daha düşüktür; fark paket kartlarında gösterilir.",
  },
  {
    question: "Hosting paketlerinde SSL ücretsiz mi?",
    answer:
      "Evet. Tüm hosting paketlerinde Let's Encrypt SSL sertifikası ücretsizdir. Kurum doğrulaması gereken durumlar için ücretli SSL sertifikaları da sunuyoruz.",
  },
  {
    question: "Sunucularınız nerede?",
    answer: "Sunucularımız İstanbul lokasyonunda barındırılır.",
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
  {
    question: "İade koşulları nelerdir?",
    answer:
      "İade koşullarımız hizmet türüne göre değişir. Ayrıntılar için İade Koşulları sayfamızı inceleyebilirsiniz.",
  },
];

function minBy<T>(items: T[], value: (item: T) => number | null | undefined): number | null {
  const values = items.map(value).filter((v): v is number => typeof v === "number" && v > 0);
  return values.length ? Math.min(...values) : null;
}

export default async function Home() {
  const [linuxProducts, vdsProducts, sslProducts, tlds] = await Promise.all([
    getProductsBySubType("hosting", "linux"),
    getProductsBySubType("vds"),
    getProductsBySubType("ssl", "standart"),
    getDomainTlds(),
  ]);

  const hostingPlans = linuxProducts.slice(0, 4).map((product) => productToPlanCard(product, { maxSpecs: 6 }));
  const vdsPlans = vdsProducts
    .slice(0, 5)
    .map((product) => productToServerRow(product, { href: "/sunucu/vds" }));
  const featuredTlds = tlds.slice(0, 8).map((tld) => ({
    ext: tld.ext,
    price: tld.registerPrice,
    renewPrice: tld.renewPrice,
  }));

  const startingPrices: StartingPrice[] = [];
  const hostingFrom = minBy(hostingPlans, (p) => p.monthlyPrice);
  if (hostingFrom) {
    startingPrices.push({ label: "Linux hosting", href: "/hosting/linux", amount: hostingFrom, period: "ay" });
  }
  const vdsFrom = minBy(vdsPlans, (p) => p.monthlyPrice);
  if (vdsFrom) {
    startingPrices.push({ label: "VDS sunucu", href: "/sunucu/vds", amount: vdsFrom, period: "ay" });
  }
  const domainFrom = minBy(tlds, (t) => t.registerPrice);
  if (domainFrom) {
    startingPrices.push({ label: "Alan adı", href: "/domain/kayit", amount: domainFrom, period: "yıl" });
  }
  const sslFrom = minBy(sslProducts, (p) => {
    const price = p.pricingTiers.find((t) => t.period === "yearly")?.price;
    return price === undefined ? undefined : toNumber(price);
  });
  if (sslFrom) {
    startingPrices.push({ label: "SSL sertifikası", href: "/ssl/standart", amount: sslFrom, period: "yıl" });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <HomeHero startingPrices={startingPrices} />
        <TrustBar />
        <DomainSearchSection tlds={featuredTlds} />
        <HostingSolutions hostingPlans={hostingPlans} vdsPlans={vdsPlans} />

        <Section aria-labelledby="neden-heading" divider>
          <SectionHeading
            id="neden-heading"
            eyebrow="Neden KLEACORE"
            title="Altyapı tarafını biz yönetelim, siz işinize odaklanın"
            description="İddialı vaatler yerine somut özellikler: neyin dahil olduğunu ve ne kadar ödeyeceğinizi baştan bilin."
            className="mb-12"
          />
          <FeatureGrid items={whyItems} columns={4} />
        </Section>

        <Section tone="muted" aria-labelledby="altyapi-heading" divider>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <SectionHeading
                id="altyapi-heading"
                eyebrow="Altyapı"
                title="Bilinen, kanıtlanmış bileşenler"
                description="Hosting paketlerimiz endüstri standardı yazılımlar üzerine kurulu. Her katmanın ne olduğunu açıkça yazıyoruz."
              />
              <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 text-sm">
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Web sunucu</dt>
                  <dd className="mt-1 font-medium">LiteSpeed</dd>
                </div>
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Kontrol paneli</dt>
                  <dd className="mt-1 font-medium">cPanel</dd>
                </div>
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Sertifika</dt>
                  <dd className="mt-1 font-medium">Let&apos;s Encrypt</dd>
                </div>
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Lokasyon</dt>
                  <dd className="mt-1 font-medium">İstanbul</dd>
                </div>
              </dl>
            </div>
            <InfraStack />
          </div>
        </Section>

        <FaqSection items={homeFaqs} divider />

        <CtaBand
          eyebrow="Başlayın"
          title="Alan adınızı bulun, sitenizi bugün yayına alın"
          description="Hosting paketinizi seçin, alan adınızı ekleyin; cPanel, LiteSpeed ve ücretsiz SSL ile hemen başlayın."
          primary={{ label: "Hosting paketlerini incele", href: "/hosting/linux" }}
          secondary={{ label: "VDS sunucuları incele", href: "/sunucu/vds" }}
        />
      </main>
      <Footer />
    </div>
  );
}
