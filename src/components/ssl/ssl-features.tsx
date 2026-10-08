import { BadgeCheck, Clock, Globe, Headphones, MonitorCheck, ShieldCheck } from "lucide-react";
import { FeatureGrid, type FeatureItem } from "@/components/site/feature-grid";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";

export const sslFeatureItems: FeatureItem[] = [
  {
    icon: BadgeCheck,
    title: "DV, OV ve EV doğrulama",
    description: "Alan adı, kurum veya genişletilmiş doğrulama seviyelerinden ihtiyacınıza uygun olanı seçin.",
  },
  {
    icon: Globe,
    title: "Wildcard ve çoklu alan adı",
    description: "Tüm alt alan adlarını ya da birden fazla alan adını tek sertifikayla koruyun.",
  },
  {
    icon: Clock,
    title: "Doğrulamaya göre teslim",
    description: "Sertifika, doğrulama tamamlandıktan sonra düzenlenir. DV'de alan adı, OV ve EV'de kurum bilgileri doğrulanır.",
  },
  {
    icon: ShieldCheck,
    title: "Garanti kapsamı",
    description: "Ücretli sertifikalarda sertifika türüne göre değişen garanti kapsamı bulunur; tutar paket bilgisinde yazar.",
  },
  {
    icon: MonitorCheck,
    title: "Tarayıcı uyumluluğu",
    description: "Sertifikalar güncel masaüstü ve mobil tarayıcılarda tanınır.",
  },
  {
    icon: Headphones,
    title: "Kurulum desteği",
    description: "CSR oluşturma ve kurulum adımlarında destek ekibimizden yardım alabilirsiniz.",
  },
];

export function SSLFeatures() {
  return (
    <Section divider>
      <SectionHeading
        eyebrow="SSL sertifikaları"
        title="Doğru sertifikayı seçin"
        description="Hosting paketlerinde Let's Encrypt ücretsizdir. Kurum doğrulaması veya garanti gerekiyorsa ücretli sertifikaları tercih edin."
        className="mb-12"
      />
      <FeatureGrid items={sslFeatureItems} columns={3} />
    </Section>
  );
}
