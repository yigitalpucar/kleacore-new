import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CtaBand, FaqSection, PageHeader, Section, SectionHeading, TrustBar } from "@/components/site";
import { SSLFeatures } from "@/components/ssl/ssl-features";
import { sslFaqs } from "@/components/ssl/ssl-faq";
import { SslPlanGrid } from "@/components/site/domain/ssl-plan-grid";
import type { SslPlan } from "@/components/site/domain/ssl-plan";
import {
  SslIssuanceSection,
  SslValidationComparison,
  sslTrustBarItems,
} from "@/components/site/domain/ssl-sections";

export const Content = ({ plans }: { plans: SslPlan[] }) => {
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <PageHeader
          eyebrow="SSL · DV ve OV"
          title="Standart SSL sertifikaları"
          description="Tek alan adı için DV ve OV sertifikalar. Hosting paketlerindeki ücretsiz Let's Encrypt yeterli değilse, kurum doğrulaması ve garanti kapsamı için ücretli sertifika seçin."
          breadcrumbs={[{ label: "SSL" }, { label: "Standart SSL" }]}
        />

        <TrustBar items={sslTrustBarItems} bordered={false} />

        <Section divider aria-labelledby="ssl-paketler">
          <SectionHeading
            id="ssl-paketler"
            eyebrow="Sertifikalar"
            title="Tek alan adı için sertifikalar"
            description="Fiyatlar yıllıktır. Fiyatlara KDV dahil değildir; %20 KDV ödeme adımında eklenir."
            className="mb-10"
          />
          <SslPlanGrid plans={plans} subType="standart" />
        </Section>

        <SslValidationComparison tone="muted" />
        <SSLFeatures />
        <SslIssuanceSection tone="muted" />

        <FaqSection items={sslFaqs} description="SSL sertifikaları hakkında merak edilenler." divider />

        <CtaBand
          eyebrow="Daha fazla alan adı"
          title="Alt alan adlarınızı da korumak mı istiyorsunuz?"
          description="Wildcard SSL, ana alan adınızı ve tüm birinci seviye alt alan adlarını tek sertifikayla korur."
          primary={{ label: "Wildcard SSL", href: "/ssl/wildcard" }}
          secondary={{ label: "EV SSL", href: "/ssl/ev" }}
        />
      </main>
      <Footer />
    </div>
  );
};
