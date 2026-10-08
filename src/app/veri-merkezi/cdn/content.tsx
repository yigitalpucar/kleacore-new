import { BarChart3, Gauge, Globe, Image as ImageIcon, Lock, ShieldCheck, Zap } from "lucide-react";
import type { FeatureItem } from "@/components/site/feature-grid";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import type { ProductWithPricing } from "@/lib/products/map-product";
import { CartPlanGrid } from "@/components/site/sunucu/cart-plan-grid";
import { DcLanding } from "@/components/site/sunucu/dc-landing";
import { dcFaqs, productToDcCard } from "@/components/site/sunucu/dc-catalog";

const features: FeatureItem[] = [
  {
    icon: Gauge,
    title: "Önbellekleme",
    description: "Görseller, CSS, JavaScript ve diğer statik dosyalar önbelleğe alınarak daha hızlı sunulur.",
  },
  {
    icon: Lock,
    title: "SSL dahil",
    description: "Tüm CDN paketlerinde SSL sertifikası dahildir; üst paketlerde wildcard ve özel sertifika.",
  },
  {
    icon: ShieldCheck,
    title: "DDoS ve WAF",
    description: "Pakete göre temel veya gelişmiş DDoS koruması; Business ve üzeri paketlerde WAF.",
  },
  {
    icon: BarChart3,
    title: "Gerçek zamanlı analitik",
    description: "Trafik ve önbellek kullanımınızı panelden izleyin.",
  },
  {
    icon: ImageIcon,
    title: "Görsel optimizasyon",
    description: "Business paketinden itibaren görseller otomatik olarak optimize edilir.",
  },
  {
    icon: Zap,
    title: "DNS ile kolay kurulum",
    description: "DNS kayıtlarınızı güncelleyerek CDN'i etkinleştirirsiniz; kod değişikliği gerekmez.",
  },
];

export function Content({ products }: { products: ProductWithPricing[] }) {
  return (
    <DcLanding
      service="cdn"
      eyebrow="İçerik dağıtım ağı"
      title="CDN Hizmeti"
      description="Sitenizin statik içeriklerini CDN ağı üzerinden önbelleğe alın; sayfalarınız ziyaretçilerinize daha hızlı ulaşsın, sunucunuzun yükü azalsın."
      breadcrumb="CDN"
      trustItems={[
        { icon: Lock, label: "SSL dahil", description: "Tüm paketlerde" },
        { icon: ShieldCheck, label: "DDoS koruması", description: "Pakete göre" },
        { icon: BarChart3, label: "Analitik", description: "Gerçek zamanlı" },
        { icon: Globe, label: "DNS ile kurulum", description: "Kod değişikliği yok" },
      ]}
      featuresTitle="CDN paketlerinde neler var?"
      featuresDescription="Trafik kotası, PoP sayısı ve güvenlik özellikleri pakete göre değişir; ayrıntılar paket kartlarında yazar."
      features={features}
      faqs={dcFaqs(products)}
      faqDescription="CDN hizmeti hakkında merak edilenler."
      cta={{
        title: "Daha yüksek trafik kotasına mı ihtiyacınız var?",
        description:
          "Video yayını, yüksek trafik veya özel kurallar gerektiren projeler için bize yazın; ihtiyacınıza göre teklif hazırlayalım.",
      }}
    >
      <Section divider aria-labelledby="paketler-heading">
        <SectionHeading
          id="paketler-heading"
          align="center"
          eyebrow="CDN paketleri"
          title="Trafiğinize uygun paketi seçin"
          description="Paketler aylık trafik kotası, SSL türü ve güvenlik özellikleriyle ayrılır. Fiyatlar aylıktır."
          className="mb-12"
        />
        <CartPlanGrid plans={products.map(productToDcCard)} subType="cdn" />
      </Section>
    </DcLanding>
  );
}
