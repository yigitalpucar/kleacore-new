import type { Metadata } from "next";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getTaxRate } from "@/lib/billing/tax";
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
  const taxRate = await getTaxRate();
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <SepetContent taxRate={taxRate} />
      </main>
      <Footer />
    </div>
  );
}
