import { Cable, Network, Server, Shield, Waypoints, Zap } from "lucide-react";
import { FeatureGrid, type FeatureItem } from "@/components/site/feature-grid";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";

/** Derived from the veri merkezi product catalogue (packages and limits). */
export const datacenterFeatureItems: FeatureItem[] = [
  {
    icon: Server,
    title: "Esnek raf seçenekleri",
    description: "1U'dan yarım kabinete kadar barındırma paketleri arasından seçim yapın.",
  },
  {
    icon: Network,
    title: "IPv4 adresleri dahil",
    description: "Barındırma paketlerinde pakete göre IPv4 adresleri dahildir.",
  },
  {
    icon: Cable,
    title: "Port seçenekleri",
    description: "Pakete göre 1 Gbps veya 10 Gbps port hızı.",
  },
  {
    icon: Zap,
    title: "Tanımlı enerji limiti",
    description: "Her pakette kullanılabilir güç (W) ve trafik kotası açıkça belirtilir.",
  },
  {
    icon: Waypoints,
    title: "IP blokları ve ASN",
    description: "/29'dan /24'e IP blokları ve ASN kiralama seçenekleri.",
  },
  {
    icon: Shield,
    title: "DDoS koruma paketleri",
    description: "Layer 3-4 veya Layer 3-4-7 filtreleme içeren koruma paketleri.",
  },
];

export function DatacenterFeatures() {
  return (
    <Section divider>
      <SectionHeading
        eyebrow="Veri merkezi"
        title="Altyapı hizmetlerinde neler var?"
        description="Paket ayrıntıları (enerji, port, trafik, IP) her ürünün kartında listelenir."
        className="mb-12"
      />
      <FeatureGrid items={datacenterFeatureItems} columns={3} />
    </Section>
  );
}
