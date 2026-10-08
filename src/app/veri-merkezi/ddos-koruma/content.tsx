import { Activity, Layers, Radar, ShieldCheck, SlidersHorizontal, Waypoints } from "lucide-react";
import type { FeatureItem } from "@/components/site/feature-grid";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import type { ProductWithPricing } from "@/lib/products/map-product";
import { CartPlanGrid } from "@/components/site/sunucu/cart-plan-grid";
import { DcLanding } from "@/components/site/sunucu/dc-landing";
import { dcFaqs, productToDcCard } from "@/components/site/sunucu/dc-catalog";

const features: FeatureItem[] = [
  {
    icon: Layers,
    title: "Layer 3-4 ve Layer 7",
    description: "Giriş paketinde ağ ve taşıma katmanı; üst paketlerde uygulama katmanı (HTTP flood vb.) koruması.",
  },
  {
    icon: Radar,
    title: "Otomatik algılama",
    description: "Saldırı trafiği otomatik olarak tespit edilir ve filtrelenir; meşru trafik geçmeye devam eder.",
  },
  {
    icon: Activity,
    title: "Gerçek zamanlı izleme",
    description: "Trafiğinizi ve filtrelenen saldırıları anlık olarak takip edin.",
  },
  {
    icon: SlidersHorizontal,
    title: "Özel kurallar",
    description: "Pro ve üzeri paketlerde uygulamanıza özel filtreleme kuralları tanımlayabilirsiniz.",
  },
  {
    icon: Waypoints,
    title: "DNS veya BGP ile etkinleştirme",
    description: "Korumayı DNS ayarlarıyla ya da BGP yönlendirmesiyle devreye alırsınız; kurulumda ekibimiz destek olur.",
  },
  {
    icon: ShieldCheck,
    title: "Kapasiteye göre paket",
    description: "Mitigasyon kapasitesi her paketin kartında açıkça yazar; ihtiyacınıza göre seçin.",
  },
];

export function Content({ products }: { products: ProductWithPricing[] }) {
  return (
    <DcLanding
      service="ddos-koruma"
      eyebrow="Ağ güvenliği"
      title="DDoS Koruma"
      description="Sunucunuzu ve sitenizi hizmet dışı bırakmaya yönelik saldırılara karşı koruyun. Saldırı trafiği filtrelenir, gerçek ziyaretçileriniz kesintisiz erişmeye devam eder."
      breadcrumb="DDoS Koruma"
      trustItems={[
        { icon: Layers, label: "Layer 3-4-7", description: "Pakete göre koruma" },
        { icon: Radar, label: "Otomatik algılama", description: "Tüm paketlerde" },
        { icon: Activity, label: "Anlık izleme", description: "Gerçek zamanlı" },
        { icon: Waypoints, label: "DNS / BGP", description: "Etkinleştirme yöntemi" },
      ]}
      featuresTitle="DDoS koruma paketlerinde neler var?"
      featuresDescription="Mitigasyon kapasitesi ve koruma katmanları pakete göre değişir."
      features={features}
      faqs={dcFaqs(products)}
      faqDescription="DDoS koruma hizmeti hakkında merak edilenler."
      cta={{
        title: "Saldırı altında mısınız ya da riskinizi mi değerlendirmek istiyorsunuz?",
        description: "Altyapınızı ve trafik profilinizi anlatın; size uygun koruma paketini birlikte belirleyelim.",
      }}
    >
      <Section divider aria-labelledby="paketler-heading">
        <SectionHeading
          id="paketler-heading"
          align="center"
          eyebrow="Koruma paketleri"
          title="Koruma seviyenizi seçin"
          description="Paketler mitigasyon kapasitesi, koruma katmanları ve destek seviyesiyle ayrılır. Fiyatlar aylıktır."
          className="mb-12"
        />
        <CartPlanGrid plans={products.map(productToDcCard)} subType="ddos-koruma" />
      </Section>
    </DcLanding>
  );
}
