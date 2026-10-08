import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Section } from "@/components/site/section";
import { CheckoutHeader } from "@/components/site/hosting/checkout-header";
import { PaytrCheckoutFrame } from "./checkout-frame";

export const metadata: Metadata = {
  title: "Güvenli Ödeme (PayTR)",
  description: "PayTR güvenli ödeme sayfası. Kart bilgileriniz ödeme kuruluşunun formunda girilir.",
  alternates: { canonical: "/odeme/paytr" },
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="flex-1">
        <CheckoutHeader
          eyebrow="Ödeme · PayTR"
          title="Güvenli ödeme"
          description="Kart bilgilerinizi aşağıdaki PayTR ödeme formuna girin. Ödeme tamamlandığında faturanız otomatik olarak güncellenir."
        />
        <Section spacing="sm" container="narrow">
          <Suspense
            fallback={<div aria-hidden className="h-[600px] animate-pulse rounded-2xl border bg-muted/40" />}
          >
            <PaytrCheckoutFrame />
          </Suspense>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
