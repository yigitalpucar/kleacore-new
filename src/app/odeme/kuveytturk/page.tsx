import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Section } from "@/components/site/section";
import { CheckoutHeader } from "@/components/site/hosting/checkout-header";
import { buttonClasses } from "@/components/site/button-classes";
import { auth } from "@/lib/auth";
import { formatTRY } from "@/lib/format/price";
import {
  isKuveytTurkSessionPayable,
  loadKuveytTurkSession,
} from "@/lib/integrations/payment-gateways/providers/kuveytturk-flow";
import { KuveytTurkCardForm } from "./card-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Güvenli Ödeme",
  description: "Kredi kartı ile 3D Secure güvenli ödeme.",
  alternates: { canonical: "/odeme/kuveytturk" },
  robots: { index: false, follow: false },
};

const ERROR_MESSAGES: Record<string, string> = {
  kart: "Kart bilgileri geçersiz. Lütfen kontrol edip tekrar deneyin.",
  banka: "Bankaya şu anda ulaşılamıyor. Kartınızdan çekim yapılmadı; lütfen birkaç dakika sonra tekrar deneyin.",
  kapali: "Kredi kartı ile ödeme şu anda kullanılamıyor. Lütfen banka havalesi seçin.",
  "cok-deneme": "Çok fazla deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.",
  odenemez: "Bu ödeme oturumu artık kullanılamıyor. Fatura sayfasından yeniden ödeme başlatın.",
  bulunamadi: "Ödeme oturumu bulunamadı.",
};

interface PageProps {
  searchParams: Promise<{ ref?: string; hata?: string }>;
}

function Unavailable({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed px-6 py-12 text-center">
      <h2 className="text-lg font-semibold tracking-tight">Ödeme başlatılamadı</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      <Link href="/musteri/panel/faturalar" className={buttonClasses({ className: "mt-6" })}>
        <FileText aria-hidden className="size-4" />
        Faturalarım
      </Link>
    </div>
  );
}

export default async function Page({ searchParams }: PageProps) {
  const { ref = "", hata } = await searchParams;
  const userSession = await auth();

  if (!userSession?.user?.id) {
    redirect(`/musteri/giris?callbackUrl=${encodeURIComponent(`/odeme/kuveytturk?ref=${ref}`)}`);
  }

  const session = ref ? await loadKuveytTurkSession(ref) : null;
  const owned = session && session.customerId === userSession.user.id ? session : null;
  const errorMessage = hata ? ERROR_MESSAGES[hata] : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="flex-1">
        <CheckoutHeader
          eyebrow="Ödeme · Kredi kartı"
          title="Güvenli ödeme"
          description="Kart bilgilerinizi girin; bankanızın 3D Secure doğrulama sayfasına yönlendirileceksiniz. Kart bilgileriniz saklanmaz."
        />
        <Section spacing="sm" container="narrow">
          {!owned ? (
            <Unavailable message={ERROR_MESSAGES.bulunamadi} />
          ) : !isKuveytTurkSessionPayable(owned) ? (
            <Unavailable message={ERROR_MESSAGES.odenemez} />
          ) : (
            <KuveytTurkCardForm
              merchantOrderId={owned.merchantOrderId}
              amountLabel={formatTRY(owned.amount, { keepDecimals: true })}
              invoiceNumbers={owned.payments.map((payment) => payment.invoice.invoiceNumber)}
              errorMessage={errorMessage}
            />
          )}
        </Section>
      </main>
      <Footer />
    </div>
  );
}
