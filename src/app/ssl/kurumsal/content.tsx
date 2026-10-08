import { CalendarClock, FileBadge, Layers, ListChecks } from "lucide-react";
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
import { SslPlanGrid } from "@/components/site/domain/ssl-plan-grid";
import type { SslPlan } from "@/components/site/domain/ssl-plan";
import {
  SslIssuanceSection,
  SslValidationComparison,
  sslTrustBarItems,
} from "@/components/site/domain/ssl-sections";

const topics: FeatureItem[] = [
  {
    icon: Layers,
    title: "Sertifika türleri ve sayısı",
    description: "Hangi alan adları için DV, OV, EV veya wildcard sertifika gerektiğini birlikte belirleriz.",
  },
  {
    icon: FileBadge,
    title: "Doğrulama belgeleri",
    description: "OV ve EV sertifikalar için gereken kurum bilgilerini ve belgeleri önceden netleştiririz.",
  },
  {
    icon: CalendarClock,
    title: "Yenileme takvimi",
    description: "Sertifikaların bitiş tarihlerini planlayarak süresi dolan sertifika riskini azaltırız.",
  },
  {
    icon: ListChecks,
    title: "Fiyat ve faturalandırma",
    description: "Teklif, sertifika sayısı ve türüne göre hazırlanır; fiyatlar KDV hariç belirtilir.",
  },
];

const faqs: FaqItem[] = [
  {
    question: "Kurumsal SSL teklifi nasıl alınır?",
    answer:
      "Paketlerden birinde \"Teklif alın\" düğmesine tıklayın veya iletişim formundan bize yazın. İhtiyaç duyduğunuz sertifika türlerini ve alan adı sayısını belirtirseniz teklifi daha hızlı hazırlarız.",
  },
  {
    question: "Hangi sertifika türlerini alabilirim?",
    answer: "DV, OV, EV ve wildcard sertifikaları kurumsal teklif kapsamında birlikte alabilirsiniz.",
  },
  {
    question: "Sertifikalar ne zaman teslim edilir?",
    answer:
      "Her sertifika, sertifika otoritesinin doğrulaması tamamlandıktan sonra düzenlenir. DV'de bu genellikle kısa sürer; OV ve EV'de süre kurum doğrulamasına bağlıdır. Sipariş anında otomatik sertifika üretilmez.",
  },
  {
    question: "Fiyatlara KDV dahil mi?",
    answer: "Hayır. Teklif ve fiyatlara KDV dahil değildir; %20 KDV ödeme adımında eklenir.",
  },
];

export const Content = ({ plans }: { plans: SslPlan[] }) => {
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <PageHeader
          eyebrow="SSL · Kurumsal"
          title="Kurumsal SSL çözümleri"
          description="Çok sayıda alan adı için farklı türde sertifikalara ihtiyaç duyan kurumlara, ihtiyaca göre teklif hazırlıyoruz."
          breadcrumbs={[{ label: "SSL" }, { label: "Kurumsal SSL" }]}
        />

        <TrustBar items={sslTrustBarItems} bordered={false} />

        <Section divider aria-labelledby="ssl-paketler">
          <SectionHeading
            id="ssl-paketler"
            eyebrow="Paketler"
            title="Kurumsal paketler"
            description="Kurumsal paketler size özel fiyatlandırılır. Teklif talebiniz iletişim formu üzerinden ekibimize ulaşır."
            className="mb-10"
          />
          <SslPlanGrid plans={plans} subType="kurumsal" />
        </Section>

        <Section tone="muted" divider>
          <SectionHeading
            eyebrow="Teklif süreci"
            title="Teklif hazırlarken neleri konuşuruz?"
            description="Kısa bir ön görüşmeyle ihtiyacınızı netleştirir, sertifika sayısına ve türüne göre fiyat veririz."
            className="mb-12"
          />
          <FeatureGrid items={topics} columns={4} />
        </Section>

        <SslValidationComparison />
        <SslIssuanceSection tone="muted" />

        <FaqSection items={faqs} description="Kurumsal SSL hakkında merak edilenler." divider />

        <CtaBand
          eyebrow="Teklif"
          title="İhtiyacınızı anlatın, teklif hazırlayalım"
          description="Alan adı sayısını ve ihtiyaç duyduğunuz sertifika türlerini yazmanız yeterli."
          primary={{ label: "Teklif isteyin", href: "/iletisim?konu=Kurumsal SSL teklifi" }}
          secondary={{ label: "Standart SSL", href: "/ssl/standart" }}
        />
      </main>
      <Footer />
    </div>
  );
};
