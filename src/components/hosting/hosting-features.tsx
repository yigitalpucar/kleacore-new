import { Archive, Gauge, HardDrive, Headphones, Lock, PanelsTopLeft } from "lucide-react";
import { FeatureGrid, type FeatureItem } from "@/components/site/feature-grid";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";

/** Facts that hold for every hosting package (see product data). */
export const hostingFeatureItems: FeatureItem[] = [
  {
    icon: Lock,
    title: "Ücretsiz SSL",
    description: "Tüm hosting paketlerinde Let's Encrypt SSL sertifikası ücretsiz olarak gelir; siteniz HTTPS ile yayında olur.",
  },
  {
    icon: Gauge,
    title: "LiteSpeed web sunucu",
    description: "Siteleriniz LiteSpeed web sunucu yazılımı üzerinde çalışır.",
  },
  {
    icon: PanelsTopLeft,
    title: "cPanel kontrol paneli",
    description: "Dosya, e-posta, veritabanı ve alan adı ayarlarınızı cPanel üzerinden yönetin.",
  },
  {
    icon: HardDrive,
    title: "SSD depolama",
    description: "Paket disk alanları SSD üzerinde sunulur; disk kotası her paketin özelliklerinde yazar.",
  },
  {
    icon: Archive,
    title: "Otomatik yedekleme",
    description: "Paketinize göre haftalık veya günlük otomatik yedek alınır.",
  },
  {
    icon: Headphones,
    title: "7/24 destek",
    description: "Müşteri panelinden destek talebi açabilir veya support@kleacore.com adresine yazabilirsiniz.",
  },
];

export function HostingFeatures() {
  return (
    <Section divider>
      <SectionHeading
        eyebrow="Tüm paketlerde"
        title="Her hosting paketinde standart olanlar"
        description="Paketler disk, trafik ve e-posta kotalarıyla ayrılır; aşağıdakiler hepsinde ortaktır."
        className="mb-12"
      />
      <FeatureGrid items={hostingFeatureItems} columns={3} />
    </Section>
  );
}
