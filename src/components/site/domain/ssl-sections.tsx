import { FileBadge, Globe, Headphones, Shield } from "lucide-react";
import { ComparisonTable, type ComparisonColumn, type ComparisonRow } from "@/components/site/comparison-table";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import type { TrustBarItem } from "@/components/site/trust-bar";
import { StepList, type StepItem } from "./step-list";

export const sslTrustBarItems: TrustBarItem[] = [
  { icon: Shield, label: "TLS şifreleme", description: "HTTPS ile güvenli bağlantı" },
  { icon: FileBadge, label: "DV, OV, EV", description: "Doğrulama seçenekleri" },
  { icon: Globe, label: "Wildcard seçeneği", description: "Alt alan adları için" },
  { icon: Headphones, label: "7/24 Destek", description: "Kurulum yardımı" },
];

const issuanceSteps: StepItem[] = [
  {
    title: "Sipariş ve ödeme",
    description: "Sertifikayı sepete ekleyip ödemeyi tamamlayın. Sipariş anında otomatik sertifika üretilmez.",
  },
  {
    title: "CSR ve bilgiler",
    description: "Ekibimiz CSR (sertifika imzalama isteği) ve doğrulama bilgileri için sizinle iletişime geçer.",
  },
  {
    title: "Doğrulama",
    description:
      "DV'de alan adı sahipliği (e-posta, DNS veya dosya ile), OV ve EV'de ek olarak kurum bilgileri sertifika otoritesince doğrulanır.",
  },
  {
    title: "Düzenleme ve kurulum",
    description: "Sertifika düzenlenince dosyalar size iletilir; kurulum için destek ekibimizden yardım alabilirsiniz.",
  },
];

/** "Sertifika nasıl teslim edilir?" — honest, manual issuance process. */
export function SslIssuanceSection({ tone = "default" }: { tone?: "default" | "muted" }) {
  return (
    <Section tone={tone} divider>
      <SectionHeading
        eyebrow="Teslim süreci"
        title="Sertifikanız nasıl düzenlenir?"
        description="Ücretli sertifikalar, sertifika otoritesinin doğrulaması tamamlandıktan sonra düzenlenir. Süre, sertifika türüne ve doğrulama adımlarının ne kadar hızlı tamamlandığına bağlıdır."
        className="mb-10"
      />
      <StepList steps={issuanceSteps} />
    </Section>
  );
}

const columns: ComparisonColumn[] = [
  { key: "dv", label: "DV" },
  { key: "ov", label: "OV" },
  { key: "ev", label: "EV" },
];

const rows: ComparisonRow[] = [
  {
    label: "Doğrulanan bilgi",
    values: { dv: "Alan adı sahipliği", ov: "Alan adı + kurum", ev: "Alan adı + kapsamlı kurum" },
  },
  {
    label: "Kurum belgesi gerekir",
    values: { dv: false, ov: true, ev: true },
  },
  {
    label: "Sertifikada kurum adı",
    values: { dv: false, ov: true, ev: true },
  },
  {
    label: "Şifreleme gücü",
    values: { dv: "Aynı", ov: "Aynı", ev: "Aynı" },
  },
  {
    label: "Uygun kullanım",
    values: { dv: "Blog, kişisel site", ov: "Kurumsal site", ev: "E-ticaret, finans" },
  },
];

/** DV / OV / EV explanation as a comparison table (cards on phones). */
export function SslValidationComparison({ tone = "default" }: { tone?: "default" | "muted" }) {
  return (
    <Section tone={tone} divider>
      <SectionHeading
        eyebrow="Doğrulama seviyeleri"
        title="DV, OV ve EV arasındaki fark"
        description="Tüm sertifikalar aynı şifrelemeyi sağlar ve tarayıcıda kilit simgesi gösterir. Fark, sertifika otoritesinin sizin hakkınızda neyi doğruladığıdır."
        className="mb-10"
      />
      <ComparisonTable columns={columns} rows={rows} caption="DV, OV ve EV SSL karşılaştırması" />
    </Section>
  );
}
