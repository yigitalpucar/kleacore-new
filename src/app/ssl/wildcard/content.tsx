import { CircleCheck, CircleSlash, Layers } from "lucide-react";
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

const coverage: FeatureItem[] = [
  {
    icon: CircleCheck,
    title: "Kapsar: ana alan adı",
    description: "alanadi.com ve www.alanadi.com aynı sertifikayla korunur.",
  },
  {
    icon: Layers,
    title: "Kapsar: birinci seviye alt alan adları",
    description: "magaza.alanadi.com, blog.alanadi.com, panel.alanadi.com gibi tüm *.alanadi.com adresleri.",
  },
  {
    icon: CircleSlash,
    title: "Kapsamaz: ikinci seviye alt alan adları",
    description: "api.test.alanadi.com gibi adresler için *.test.alanadi.com biçiminde ayrı bir sertifika gerekir.",
  },
];

const wildcardFaqs: FaqItem[] = [
  {
    question: "Wildcard SSL kaç alt alan adını korur?",
    answer:
      "Birinci seviyedeki alt alan adlarının sayısında sınır yoktur. Sonradan eklediğiniz alt alan adları da (ör. yeni.alanadi.com) aynı sertifikayla korunur.",
  },
  {
    question: "Alt alan adlarının alt alan adlarını da korur mu?",
    answer:
      "Hayır. *.alanadi.com sertifikası yalnızca bir seviyeyi kapsar; api.test.alanadi.com için *.test.alanadi.com biçiminde ayrı sertifika gerekir.",
  },
  {
    question: "Wildcard DV ile Wildcard OV arasındaki fark nedir?",
    answer:
      "Kapsam aynıdır. DV yalnızca alan adı sahipliğini, OV ise ek olarak kurum bilgilerinizi doğrular ve kurum adı sertifika ayrıntılarında görünür.",
  },
  ...sslFaqs.filter((f) => !f.question.startsWith("Wildcard SSL nedir")),
];

export const Content = ({ plans }: { plans: SslPlan[] }) => {
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <PageHeader
          eyebrow="SSL · *.alanadi.com"
          title="Wildcard SSL sertifikaları"
          description="Ana alan adınızı ve tüm birinci seviye alt alan adlarınızı tek sertifikayla koruyun; her alt alan adı için ayrı sertifika yönetmeyin."
          breadcrumbs={[{ label: "SSL" }, { label: "Wildcard SSL" }]}
        />

        <TrustBar items={sslTrustBarItems} bordered={false} />

        <Section divider aria-labelledby="ssl-paketler">
          <SectionHeading
            id="ssl-paketler"
            eyebrow="Sertifikalar"
            title="Wildcard sertifikalar"
            description="Fiyatlar yıllıktır. Fiyatlara KDV dahil değildir; %20 KDV ödeme adımında eklenir."
            className="mb-10"
          />
          <SslPlanGrid plans={plans} subType="wildcard" />
        </Section>

        <Section tone="muted" divider>
          <SectionHeading
            eyebrow="Kapsam"
            title="Wildcard sertifika neyi korur?"
            description="Sipariş vermeden önce alt alan adı yapınızın sertifika kapsamına uyduğundan emin olun."
            className="mb-12"
          />
          <FeatureGrid items={coverage} columns={3} />
        </Section>

        <SslValidationComparison />
        <SslIssuanceSection tone="muted" />

        <FaqSection items={wildcardFaqs} description="Wildcard SSL hakkında merak edilenler." divider />

        <CtaBand
          eyebrow="Tek alan adı"
          title="Yalnızca tek bir alan adı mı koruyacaksınız?"
          description="Tek alan adı için DV ve OV sertifikalar daha uygun maliyetlidir."
          primary={{ label: "Standart SSL", href: "/ssl/standart" }}
          secondary={{ label: "Kurumsal SSL", href: "/ssl/kurumsal" }}
        />
      </main>
      <Footer />
    </div>
  );
};
