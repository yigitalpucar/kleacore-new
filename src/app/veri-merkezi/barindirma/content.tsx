import { Cable, Hand, Headphones, MapPin, MonitorCog, Network, Server, Truck, Zap } from "lucide-react";
import type { FeatureItem } from "@/components/site/feature-grid";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import type { ProductWithPricing } from "@/lib/products/map-product";
import { CartPlanGrid } from "@/components/site/sunucu/cart-plan-grid";
import { DcLanding } from "@/components/site/sunucu/dc-landing";
import { dcFaqs, productToDcCard } from "@/components/site/sunucu/dc-catalog";

type Res = Record<string, string | undefined>;

function span(products: ProductWithPricing[], key: string) {
  const values = products
    .map((p) => ((p.resourceLimits as unknown as Res | null) ?? {})[key])
    .filter((v): v is string => Boolean(v));
  const uniq = [...new Set(values)];
  if (uniq.length === 0) return "";
  return uniq.length === 1 ? uniq[0] : `${uniq[0]} – ${uniq[uniq.length - 1]}`;
}

const features: FeatureItem[] = [
  {
    icon: Server,
    title: "1U'dan yarım kabinete",
    description: "Tek sunucudan kurumsal altyapıya kadar ihtiyacınıza uygun raf alanı seçin.",
  },
  {
    icon: Zap,
    title: "Tanımlı güç limiti",
    description: "Her pakette kullanılabilir güç (W) ve aylık trafik kotası açıkça belirtilir.",
  },
  {
    icon: Network,
    title: "IPv4 adresleri dahil",
    description: "Paketlere göre IPv4 adresleri dahildir; ek blok ihtiyacınız için IPv4 kiralama sunuyoruz.",
  },
  {
    icon: Hand,
    title: "Uzaktan el desteği",
    description: "Kablo değişimi, yeniden başlatma gibi fiziksel işlemler veri merkezi ekibince yapılır.",
  },
  {
    icon: MonitorCog,
    title: "KVM over IP",
    description: "2U ve üzeri paketlerde sunucunuza BIOS seviyesinde uzaktan erişim.",
  },
  {
    icon: Truck,
    title: "Kolay teslim",
    description: "Sunucunuzu kargo ile gönderebilir veya randevu alarak kendiniz getirebilirsiniz.",
  },
];

export function Content({ products }: { products: ProductWithPricing[] }) {
  const plans = products.map(productToDcCard);
  const rack = span(products, "rackSpace");
  const port = span(products, "port");

  return (
    <DcLanding
      service="barindirma"
      eyebrow="Colocation · İstanbul"
      title="Sunucu Barındırma"
      description="Kendi sunucunuzu İstanbul'daki veri merkezimizde barındırın. Güç, ağ bağlantısı ve fiziksel güvenlik bizde; sunucunuzun yönetimi sizde."
      breadcrumb="Sunucu Barındırma"
      trustItems={[
        { icon: Server, label: rack || "Raf alanı", description: "Raf seçenekleri" },
        { icon: Cable, label: port || "Port", description: "Port hızı" },
        { icon: Network, label: "IPv4 dahil", description: "Pakete göre" },
        { icon: MapPin, label: "İstanbul", description: "Veri merkezi lokasyonu" },
        { icon: Headphones, label: "7/24 NOC", description: "Ağ izleme" },
      ]}
      map={{
        title: "Sunucunuz İstanbul'da",
        description:
          "Tüm barındırma paketleri İstanbul lokasyonunda sunulur; Türkiye'deki kullanıcılarınıza yakın, tek ve net bir konum.",
        facts: [
          { label: "Lokasyon", value: "İstanbul, Türkiye" },
          ...(rack ? [{ label: "Raf alanı", value: rack }] : []),
          ...(port ? [{ label: "Port", value: port }] : []),
          ...(span(products, "power") ? [{ label: "Güç", value: span(products, "power") }] : []),
          ...(span(products, "ip") ? [{ label: "IPv4", value: span(products, "ip") }] : []),
        ],
      }}
      featuresTitle="Barındırma hizmetinde neler var?"
      featuresDescription="Güç, trafik ve IP miktarı pakete göre değişir; ayrıntılar paket kartlarında yazar."
      features={features}
      faqs={dcFaqs(products)}
      faqDescription="Sunucu barındırma (colocation) hakkında merak edilenler."
      cta={{
        title: "Daha fazla raf alanı veya güç mü gerekiyor?",
        description:
          "Tam kabinet, ek güç veya özel ağ ihtiyaçlarınız için bize yazın; size özel teklif hazırlayalım.",
      }}
    >
      <Section divider aria-labelledby="paketler-heading">
        <SectionHeading
          id="paketler-heading"
          align="center"
          eyebrow="Barındırma paketleri"
          title="Raf alanınızı seçin"
          description="Paketler raf alanı, güç, trafik ve IPv4 adresi sayısıyla ayrılır. Fiyatlar aylıktır."
          className="mb-12"
        />
        <CartPlanGrid plans={plans} subType="barindirma" />
      </Section>
    </DcLanding>
  );
}
