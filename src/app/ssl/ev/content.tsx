import { Building2, FileText, PhoneCall, UserCheck } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import {
  CtaBand,
  FaqSection,
  FeatureGrid,
  PageHeader,
  Section,
  SectionHeading,
  TrustBar,
  type FaqItem,
  type FeatureItem,
} from "@/components/site";
import { sslFaqs } from "@/components/ssl/ssl-faq";
import { SslPlanGrid } from "@/components/site/domain/ssl-plan-grid";
import type { SslPlan } from "@/components/site/domain/ssl-plan";
import {
  SslIssuanceSection,
  SslValidationComparison,
  sslTrustBarItems,
} from "@/components/site/domain/ssl-sections";

const checks: FeatureItem[] = [
  {
    icon: Building2,
    title: "Yasal varlık",
    description: "Kurumunuzun resmi kayıtlarda aktif olarak bulunduğu doğrulanır.",
  },
  {
    icon: FileText,
    title: "Kurum bilgileri",
    description: "Ticaret unvanı, adres ve kayıt numarası gibi bilgiler resmi kaynaklarla karşılaştırılır.",
  },
  {
    icon: PhoneCall,
    title: "İletişim doğrulaması",
    description: "Kurumun telefon numarası bağımsız bir kaynaktan doğrulanır ve gerekirse arama yapılır.",
  },
  {
    icon: UserCheck,
    title: "Yetkili onayı",
    description: "Sertifika talebinin kurum adına yetkili bir kişi tarafından yapıldığı teyit edilir.",
  },
];

const evFaqs: FaqItem[] = [
  {
    question: "EV SSL nedir?",
    answer:
      "EV (Extended Validation), en kapsamlı doğrulama seviyesidir. Sertifika otoritesi kurumunuzun yasal varlığını, adresini ve iletişim bilgilerini doğrular; kurum bilgileri sertifika ayrıntılarında yer alır.",
  },
  {
    question: "EV SSL tarayıcıda yeşil adres çubuğu gösterir mi?",
    answer:
      "Hayır. Güncel tarayıcılar artık EV için ayrı bir yeşil çubuk veya adres satırında şirket adı göstermez; tüm geçerli sertifikalarda kilit simgesi görünür. Kurum bilgileri, sertifika ayrıntıları açıldığında görülür.",
  },
  {
    question: "EV doğrulaması ne kadar sürer?",
    answer:
      "Süre, belgelerin eksiksiz olmasına ve doğrulama aramalarının ne kadar hızlı yanıtlandığına bağlıdır. Paket bilgisinde yazan süre tipik bir aralıktır, garanti edilen bir süre değildir.",
  },
  ...sslFaqs.filter((f) => !f.question.startsWith("DV, OV ve EV")),
];

export const Content = ({ plans }: { plans: SslPlan[] }) => {
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <PageHeader
          eyebrow="SSL · Genişletilmiş doğrulama"
          title="EV SSL sertifikaları"
          description="En kapsamlı kurum doğrulaması. Kurumunuzun yasal varlığı, adresi ve iletişim bilgileri sertifika otoritesince doğrulanır."
          breadcrumbs={[{ label: "SSL" }, { label: "EV SSL" }]}
        />

        <TrustBar items={sslTrustBarItems} bordered={false} />

        <Section divider aria-labelledby="ssl-paketler">
          <SectionHeading
            id="ssl-paketler"
            eyebrow="Sertifikalar"
            title="EV sertifikalar"
            description="Fiyatlar yıllıktır. Fiyatlara KDV dahil değildir; %20 KDV ödeme adımında eklenir."
            className="mb-10"
          />
          <SslPlanGrid plans={plans} subType="ev" />
        </Section>

        <Section tone="muted" divider>
          <SectionHeading
            eyebrow="Doğrulama"
            title="EV doğrulamasında neler kontrol edilir?"
            description="Başvurudan önce kurum bilgilerinizin resmi kayıtlarla aynı olduğundan emin olmak süreci hızlandırır."
            className="mb-12"
          />
          <FeatureGrid items={checks} columns={4} />
        </Section>

        <SslValidationComparison />
        <SslIssuanceSection tone="muted" />

        <FaqSection items={evFaqs} description="EV SSL hakkında merak edilenler." divider />

        <CtaBand
          eyebrow="Kurumsal"
          title="Birden fazla sertifikaya mı ihtiyacınız var?"
          description="Çok sayıda alan adı veya farklı sertifika türleri için size özel teklif hazırlayalım."
          primary={{ label: "Kurumsal SSL", href: "/ssl/kurumsal" }}
          secondary={{ label: "Standart SSL", href: "/ssl/standart" }}
        />
      </main>
      <Footer />
    </div>
  );
};
