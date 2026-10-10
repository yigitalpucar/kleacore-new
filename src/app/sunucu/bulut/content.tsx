import { CalendarClock, Cpu, Gauge, HardDrive, MemoryStick, Terminal } from "lucide-react";
import type { FeatureItem } from "@/components/site/feature-grid";
import { buildPackageComparison } from "@/lib/catalog/package-comparison";
import { serverFaqs } from "@/components/sunucu/server-faq";
import type { ProductWithPricing } from "@/lib/products/map-product";
import {
  productToCartRow,
  sharedIncluded,
  type FamilySummary,
} from "@/components/site/sunucu/server-catalog";
import { ServerLanding, familyTrustItems } from "@/components/site/sunucu/server-landing";

const columns = [
  { key: "cpu", label: "İşlemci" },
  { key: "ram", label: "Bellek" },
  { key: "disk", label: "Disk" },
  { key: "port", label: "Port" },
  { key: "traffic", label: "Trafik" },
];

export function Content({
  products,
  summaries,
}: {
  products: ProductWithPricing[];
  summaries: FamilySummary[];
}) {
  const summary = summaries.find((s) => s.key === "bulut");

  const features: FeatureItem[] = [
    {
      icon: Cpu,
      title: summary?.cpuModel || "Yüksek işlemci gücü",
      description: `Bulut paketlerinde ${summary?.cpu || "pakete göre değişen"} işlemci seçenekleri.`,
    },
    {
      icon: MemoryStick,
      title: summary?.ramType ? `${summary.ramType} bellek` : "Yüksek bellek",
      description: `Pakete göre ${summary?.ram || "farklı"} bellek; yoğun uygulamalar ve önbellek için geniş alan.`,
    },
    {
      icon: HardDrive,
      title: summary?.diskType === "NVMe" ? "NVMe SSD disk" : "SSD disk",
      description: `Pakete göre ${summary?.disk || "farklı"} disk alanı.`,
    },
    {
      icon: Gauge,
      title: summary?.port ? `${summary.port} port` : "Yüksek port hızı",
      description: `Tüm bulut paketlerinde ${summary?.traffic ? `${summary.traffic.toLocaleLowerCase("tr")} trafik` : "trafik"} ve İstanbul lokasyon.`,
    },
    {
      icon: Terminal,
      title: "Tam root erişimi",
      description: "İşletim sistemi düzeyinde tam yetki; kurulum ücreti alınmaz.",
    },
    {
      icon: CalendarClock,
      title: "Aylık veya yıllık ödeme",
      description: "Dilediğiniz dönemi seçin; yıllık ödemede aylık karşılık daha düşüktür.",
    },
  ];

  return (
    <ServerLanding
      family="bulut"
      eyebrow="NVMe SSD · DDR5 · İstanbul"
      title="Bulut Sunucu"
      description="Büyüyen e-ticaret siteleri, SaaS uygulamaları ve yoğun trafikli projeler için yüksek kaynaklı sanal sunucular."
      breadcrumb="Bulut Sunucu"
      plansTitle="Bulut sunucu paketleri"
      plansDescription="Tüm paketlerde NVMe SSD disk, DDR5 bellek ve yüksek port hızı. Fiyatlar seçili ödeme dönemine göre aylık karşılık olarak gösterilir."
      rows={products.map(productToCartRow)}
      comparison={buildPackageComparison(products)}
      columns={columns}
      included={sharedIncluded(products)}
      summaries={summaries}
      trustItems={familyTrustItems(summary)}
      featuresTitle="Bulut paketlerinde neler var?"
      featuresDescription="Kaynak miktarı pakete göre değişir; aşağıdakiler tüm bulut paketlerinde ortaktır."
      features={features}
      faqs={serverFaqs}
      cta={{
        title: "Kaynak ihtiyacınızı birlikte belirleyelim",
        description:
          "Mevcut trafiğinizi ve uygulamanızı anlatın; size uygun bulut paketini birlikte seçelim.",
      }}
    />
  );
}
