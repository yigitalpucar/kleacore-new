import { CalendarClock, Cpu, Globe, HardDrive, Terminal, Wrench } from "lucide-react";
import type { FeatureItem } from "@/components/site/feature-grid";
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
  { key: "traffic", label: "Aylık trafik" },
];

export function Content({
  products,
  summaries,
}: {
  products: ProductWithPricing[];
  summaries: FamilySummary[];
}) {
  const summary = summaries.find((s) => s.key === "vps");
  const ipIncluded = sharedIncluded(products).find((f) => /ipv4/i.test(f));

  const features: FeatureItem[] = [
    {
      icon: Terminal,
      title: "Tam root erişimi",
      description: "İşletim sistemi düzeyinde tam yetki: yazılım kurulumu, servis ve güvenlik ayarları sizde.",
    },
    {
      icon: HardDrive,
      title: "SSD disk",
      description: `VPS paketlerinde disk alanı SSD üzerinde sunulur${summary?.disk ? ` (${summary.disk})` : ""}.`,
    },
    {
      icon: Cpu,
      title: summary?.cpuModel || "Sanal işlemci",
      description: `Paketlere göre ${summary?.cpu || "farklı"} işlemci ve ${summary?.ram || "farklı"} bellek seçenekleri.`,
    },
    {
      icon: Globe,
      title: ipIncluded ?? "Aylık trafik kotası",
      description: `Her pakette ${summary?.port ? `${summary.port} port ve ` : ""}pakete göre ${summary?.traffic || "belirli"} aylık trafik.`,
    },
    {
      icon: Wrench,
      title: "Ücretsiz kurulum",
      description: "VPS paketlerinde kurulum için ayrıca ücret alınmaz; sunucunuz İstanbul'da barındırılır.",
    },
    {
      icon: CalendarClock,
      title: "Aylık veya yıllık ödeme",
      description: "Dilediğiniz dönemi seçin; yıllık ödemede aylık karşılık daha düşüktür.",
    },
  ];

  return (
    <ServerLanding
      family="vps"
      eyebrow="SSD · İstanbul"
      title="VPS Sunucu"
      description="Kişisel projeler, test ortamları ve küçük işletmeler için uygun fiyatlı sanal sunucular. Tam root erişimi ve SSD disk ile hızlı bir başlangıç."
      breadcrumb="VPS Sunucu"
      plansTitle="VPS sunucu paketleri"
      plansDescription="Paketler işlemci, bellek, disk ve aylık trafik kotasıyla ayrılır. Fiyatlar seçili ödeme dönemine göre aylık karşılık olarak gösterilir."
      rows={products.map(productToCartRow)}
      columns={columns}
      included={sharedIncluded(products)}
      summaries={summaries}
      trustItems={familyTrustItems(summary)}
      featuresTitle="VPS paketlerinde neler var?"
      featuresDescription="Kaynak miktarı pakete göre değişir; aşağıdakiler tüm VPS paketlerinde ortaktır."
      features={features}
      faqs={serverFaqs}
      cta={{
        title: "Projeniz büyüdüğünde paketiniz de büyüsün",
        description:
          "VPS ile başlayın; daha fazla kaynağa ihtiyaç duyduğunuzda müşteri panelinden paket değişikliği talep edebilirsiniz.",
      }}
    />
  );
}
