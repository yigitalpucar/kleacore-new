import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Section } from "@/components/site/section";
import { CheckoutHeader } from "@/components/site/hosting/checkout-header";
import { CheckoutSteps } from "@/components/checkout/checkout-steps";
import { IyzicoCheckoutFrame } from "./checkout-frame";

export const metadata: Metadata = {
  title: "Güvenli Ödeme (iyzico)",
  description: "iyzico güvenli ödeme sayfası. Kart bilgileriniz ödeme kuruluşunun formunda girilir.",
  alternates: { canonical: "/odeme/iyzico" },
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="flex-1">
        <CheckoutHeader
          steps={<CheckoutSteps current="odeme" />}
          eyebrow="Ödeme · iyzico"
          title="Güvenli ödeme"
          description="Kart bilgilerinizi aşağıdaki iyzico ödeme formuna girin. Ödeme tamamlandığında faturanız otomatik olarak güncellenir."
        />
        <Section spacing="sm" container="narrow">
          <IyzicoCheckoutFrame />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
