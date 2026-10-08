import { Cpu, HardDrive, MapPin, MonitorCog, Server, Terminal } from "lucide-react";
import type { FeatureItem } from "@/components/site/feature-grid";
import type { FaqItem } from "@/components/site/faq-section";
import { serverFaqs } from "@/components/sunucu/server-faq";
import type { ProductWithPricing } from "@/lib/products/map-product";
import {
  productToCartRow,
  sharedIncluded,
  type FamilySummary,
} from "@/components/site/sunucu/server-catalog";
import { ServerLanding, familyTrustItems } from "@/components/site/sunucu/server-landing";

const columns = [
  { key: "cpu", label: "İşlemci", subKey: "cores" },
  { key: "ram", label: "Bellek" },
  { key: "disk", label: "Disk" },
  { key: "port", label: "Port" },
  { key: "traffic", label: "Trafik" },
];

const faqs: FaqItem[] = [
  {
    question: "Fiziksel sunucunun sanal sunucudan farkı nedir?",
    answer:
      "Fiziksel (dedicated) sunucuda donanımın tamamı yalnızca size aittir; işlemci, bellek ve diskler başka müşterilerle paylaşılmaz. Sanal sunucularda ise bir fiziksel sunucunun kaynakları sanallaştırılarak paketlere ayrılır.",
  },
  {
    question: "IPMI / KVM erişimi ne işe yarar?",
    answer:
      "Sunucunuza işletim sisteminden bağımsız, uzaktan konsol erişimi sağlar. İşletim sistemi yanıt vermediğinde bile sunucunuzu yeniden başlatabilir veya kurulum yapabilirsiniz.",
  },
  ...serverFaqs.filter((f) => !/fiziksel sunucu ne zaman/i.test(f.question)),
];

export function Content({
  products,
  summaries,
}: {
  products: ProductWithPricing[];
  summaries: FamilySummary[];
}) {
  const summary = summaries.find((s) => s.key === "fiziksel");
  const included = sharedIncluded(products);

  const features: FeatureItem[] = [
    {
      icon: Server,
      title: "Size özel donanım",
      description: "Sunucunun tüm kaynakları yalnızca size ayrılır; başka müşterilerle paylaşılmaz.",
    },
    {
      icon: Cpu,
      title: summary?.cpuModel || "Intel Xeon işlemci",
      description: `Pakete göre ${summary?.cpu || "farklı çekirdek sayıları"}; yoğun işlem yükleri ve sanallaştırma için.`,
    },
    {
      icon: HardDrive,
      title: summary?.diskType === "NVMe" ? "NVMe SSD diskler" : "SSD diskler",
      description: `Pakete göre ${summary?.disk || "farklı"} disk yapılandırması ve ${summary?.ram || "farklı"} bellek.`,
    },
    {
      icon: MonitorCog,
      title: "IPMI / KVM erişimi",
      description: "İşletim sisteminden bağımsız uzaktan konsol ile sunucunuza her durumda erişin.",
    },
    {
      icon: Terminal,
      title: "Tam root erişimi",
      description: "İşletim sistemi düzeyinde tam yetki: yazılım, servis ve güvenlik ayarları sizde.",
    },
    {
      icon: MapPin,
      title: "İstanbul lokasyon",
      description: `Sunucular İstanbul'da barındırılır; pakete göre ${summary?.port || "farklı"} port.`,
    },
  ];

  return (
    <ServerLanding
      family="fiziksel"
      eyebrow="Intel Xeon · NVMe SSD · İstanbul"
      title="Fiziksel Sunucu"
      description="Donanımın tamamı size ait. Intel Xeon işlemciler, NVMe SSD diskler ve IPMI/KVM erişimi ile yüksek işlem yükü gerektiren projeler için."
      breadcrumb="Fiziksel Sunucu"
      plansTitle="Fiziksel sunucu paketleri"
      plansDescription="Paketler işlemci, bellek, disk ve port hızıyla ayrılır. Fiyatlar seçili ödeme dönemine göre aylık karşılık olarak gösterilir."
      rows={products.map(productToCartRow)}
      columns={columns}
      included={included}
      summaries={summaries}
      trustItems={familyTrustItems(summary)}
      featuresTitle="Fiziksel sunucularda neler var?"
      featuresDescription="Donanım yapılandırması pakete göre değişir; aşağıdakiler tüm fiziksel sunucularda ortaktır."
      features={features}
      faqs={faqs}
      cta={{
        title: "Özel bir yapılandırmaya mı ihtiyacınız var?",
        description:
          "Listedeki paketlerin dışında bir donanım ihtiyacınız varsa bize yazın; ihtiyacınızı birlikte değerlendirelim.",
      }}
    />
  );
}
