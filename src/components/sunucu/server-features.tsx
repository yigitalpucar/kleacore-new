import { CalendarClock, HardDrive, Headphones, MapPin, Terminal, Wrench } from "lucide-react";
import { FeatureGrid, type FeatureItem } from "@/components/site/feature-grid";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";

export const serverFeatureItems: FeatureItem[] = [
  {
    icon: Terminal,
    title: "Tam root erişimi",
    description: "Sunucunuzda yönetici yetkisiyle istediğiniz yazılımı kurup yapılandırın.",
  },
  {
    icon: HardDrive,
    title: "NVMe SSD disk",
    description: "VDS paketlerinde disk alanı NVMe SSD üzerinde sunulur.",
  },
  {
    icon: MapPin,
    title: "İstanbul lokasyon",
    description: "Sunucular İstanbul'da barındırılır; Türkiye'deki ziyaretçilere yakın konum.",
  },
  {
    icon: Wrench,
    title: "Ücretsiz kurulum",
    description: "Sunucu paketlerinde kurulum için ayrıca ücret alınmaz.",
  },
  {
    icon: CalendarClock,
    title: "Aylık veya yıllık ödeme",
    description: "Dilediğiniz dönemi seçin; yıllık ödemede aylık karşılık daha düşüktür.",
  },
  {
    icon: Headphones,
    title: "7/24 destek",
    description: "Müşteri panelinden destek talebi açabilir veya support@kleacore.com adresine yazabilirsiniz.",
  },
];

export function ServerFeatures() {
  return (
    <Section tone="muted" divider>
      <SectionHeading
        eyebrow="Sunucu hizmetleri"
        title="Sunucu paketlerinde neler var?"
        description="Kaynaklar (işlemci, bellek, disk) pakete göre değişir; aşağıdakiler ortak özelliklerdir."
        className="mb-12"
      />
      <FeatureGrid items={serverFeatureItems} columns={3} />
    </Section>
  );
}
