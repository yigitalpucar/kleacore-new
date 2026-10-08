import type { Metadata } from "next";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getTaxRate } from "@/lib/billing/tax";
import { auth } from "@/lib/auth";
import { getCustomerPaymentOptions } from "@/lib/payments/payment-options";
import { isEmailVerified } from "@/lib/auth/email-verification";
import { getCheckoutLegalDocuments, getLegalBuyer, getLegalSeller } from "@/lib/legal/documents";
import { SepetContent } from "./content";

export const metadata: Metadata = {
  title: "Sepetiniz",
  description: "Sepetinizdeki alan adı, hosting ve sunucu hizmetlerini gözden geçirin, ödeme yöntemini seçin ve siparişinizi tamamlayın.",
  alternates: { canonical: "/sepet" },
  openGraph: { title: "Sepetiniz | KLEACORE", url: "/sepet" },
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function SepetPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const [taxRate, paymentOptions, documents, seller, buyer, emailVerified] = await Promise.all([
    getTaxRate(),
    getCustomerPaymentOptions(userId),
    getCheckoutLegalDocuments(),
    getLegalSeller(),
    userId ? getLegalBuyer(userId) : null,
    userId ? isEmailVerified(userId) : true,
  ]);
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <SepetContent
          taxRate={taxRate}
          paymentOptions={paymentOptions}
          emailVerified={emailVerified}
          userEmail={session?.user?.email ?? null}
          legal={{
            documents: documents.map((document) => ({
              id: document.id,
              type: document.type,
              version: document.version,
              title: document.title,
              content: document.content,
              isPlaceholder: document.isPlaceholder,
            })),
            seller,
            buyer,
          }}
        />
      </main>
      <Footer />
    </div>
  );
}
