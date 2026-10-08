import { CalendarClock, Cpu, HardDrive, MapPin, Terminal, Wrench } from "lucide-react";
import type { FeatureItem } from "@/components/site/feature-grid";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { serverFaqs } from "@/components/sunucu/server-faq";
import type { ProductWithPricing } from "@/lib/products/map-product";
import { RootTerminal, type TerminalStep } from "@/components/site/sunucu/root-terminal";
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

/** Terminal steps; the resource output mirrors the popular plan's DB specs. */
function terminalSteps(product: ProductWithPricing | undefined): TerminalStep[] {
  const r = (product?.resourceLimits as Record<string, string> | undefined) ?? {};
  const cpu = r.cpu?.match(/\d+/)?.[0];
  const ram = r.ram?.match(/\d+/)?.[0];
  const disk = r.disk?.match(/\d+/)?.[0];
  return [
    {
      id: "ssh",
      icon: "ssh",
      title: "SSH ile bağlanın",
      description:
        "Sunucunuz teslim edildiğinde size iletilen IP adresi ve root bilgileriyle herhangi bir terminalden bağlanırsınız.",
      command: "ssh root@203.0.113.10",
      output: ["root@203.0.113.10's password: ********", "Oturum açıldı. Tam yönetici yetkisine sahipsiniz."],
    },
    {
      id: "install",
      icon: "install",
      title: "İstediğiniz yazılımı kurun",
      description:
        "Root yetkisiyle web sunucu, veritabanı ya da kendi uygulamanızı kurar ve yapılandırırsınız. Örnekte bir web sunucu kuruluyor.",
      command: "apt update && apt install -y nginx",
      output: ["Paket listeleri okunuyor... Tamam", "nginx kuruluyor...", "Kurulum tamamlandı."],
    },
    {
      id: "monitor",
      icon: "monitor",
      title: "Kaynaklarınızı görün",
      description: product
        ? `Paketinize ayrılan işlemci, bellek ve diski kendiniz izlersiniz. Örnek çıktı ${product.name} paketinin değerlerini gösterir.`
        : "Paketinize ayrılan işlemci, bellek ve diski kendiniz izlersiniz.",
      command: "nproc && free -h && df -h /",
      output: [
        cpu ?? "—",
        `Mem:  toplam ${ram ? `${ram}G` : "—"}`,
        `/dev/vda1  boyut ${disk ? `${disk}G` : "—"}  bağlama /`,
      ],
    },
    {
      id: "firewall",
      icon: "firewall",
      title: "Güvenliği siz yönetin",
      description:
        "Güvenlik duvarı kurallarını, SSH anahtarlarını ve kullanıcıları ihtiyacınıza göre siz belirlersiniz.",
      command: "ufw allow 22/tcp && ufw enable",
      output: ["Kural eklendi", "Güvenlik duvarı etkin ve sistem açılışında başlatılacak"],
    },
  ];
}

export function Content({
  products,
  summaries,
}: {
  products: ProductWithPricing[];
  summaries: FamilySummary[];
}) {
  const summary = summaries.find((s) => s.key === "vds");
  const popular = products.find((p) => p.isPopular) ?? products[0];

  const features: FeatureItem[] = [
    {
      icon: Terminal,
      title: "Tam root erişimi",
      description: "İşletim sistemi düzeyinde tam yetki: yazılım kurulumu, servis ve güvenlik ayarları sizde.",
    },
    {
      icon: HardDrive,
      title: summary?.diskType === "NVMe" ? "NVMe SSD disk" : "SSD disk",
      description: "Tüm VDS paketlerinde disk alanı NVMe SSD üzerinde sunulur.",
    },
    {
      icon: Cpu,
      title: summary?.cpuModel || "Ayrılmış işlemci",
      description: `İşlemci ve bellek kaynakları paketinize ayrılmış olarak tanımlanır${summary?.cpu ? ` (${summary.cpu})` : ""}.`,
    },
    {
      icon: MapPin,
      title: "İstanbul lokasyon",
      description: `Sunucular İstanbul'da barındırılır${summary?.port ? `; tüm paketlerde ${summary.port} port` : ""}.`,
    },
    {
      icon: Wrench,
      title: "Ücretsiz kurulum",
      description: "VDS paketlerinde kurulum için ayrıca ücret alınmaz.",
    },
    {
      icon: CalendarClock,
      title: "Aylık veya yıllık ödeme",
      description: "Dilediğiniz dönemi seçin; yıllık ödemede aylık karşılık daha düşüktür.",
    },
  ];

  return (
    <ServerLanding
      family="vds"
      eyebrow="NVMe SSD · İstanbul"
      title="VDS Sunucu"
      description="Kaynakları size ayrılmış, NVMe SSD diskli sanal sunucular. Tam root erişimiyle uygulamanızı istediğiniz gibi kurun ve yönetin."
      breadcrumb="VDS Sunucu"
      plansTitle="VDS sunucu paketleri"
      plansDescription="Tüm paketlerde NVMe SSD disk ve İstanbul lokasyon. Fiyatlar seçili ödeme dönemine göre aylık karşılık olarak gösterilir."
      rows={products.map(productToCartRow)}
      columns={columns}
      included={sharedIncluded(products)}
      summaries={summaries}
      trustItems={familyTrustItems(summary)}
      featuresTitle="VDS paketlerinde neler var?"
      featuresDescription="Kaynak miktarı pakete göre değişir; aşağıdakiler tüm VDS paketlerinde ortaktır."
      features={features}
      faqs={serverFaqs}
      cta={{
        title: "Hangi VDS paketinin size uygun olduğundan emin değil misiniz?",
        description:
          "Projenizi anlatın, kaynak ihtiyacına göre doğru paketi birlikte seçelim. Daha sonra paket değişikliği de talep edebilirsiniz.",
      }}
    >
      <Section divider aria-labelledby="root-heading">
        <SectionHeading
          id="root-heading"
          eyebrow="Root erişimi"
          title="Sunucunuz, kurallarınız"
          description="VDS sunucunuza SSH ile bağlanır, yönetici yetkisiyle her şeyi kendiniz yapılandırırsınız. Aşağıdaki adımlar tipik bir ilk kurulumu temsil eder."
          className="mb-12"
        />
        <RootTerminal steps={terminalSteps(popular)} host={popular?.slug ?? "vds"} />
      </Section>
    </ServerLanding>
  );
}
