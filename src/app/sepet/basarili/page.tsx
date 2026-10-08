import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, FileText, Package, Receipt } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Topbar } from "@/components/layout/topbar";
import { buttonClasses } from "@/components/site/button-classes";
import { Section } from "@/components/site/section";
import { CheckoutHeader } from "@/components/site/hosting/checkout-header";
import { formatTRY } from "@/lib/format/price";
import { db } from "@/lib/db";
import { sum, toNumber } from "@/lib/money";

const formatPrice = (price: number | string | { toString(): string }) =>
  formatTRY(Number(price), { keepDecimals: true });

export const metadata: Metadata = {
  title: "Ödeme Alındı",
  description: "Ödemenizin durumu ve fatura özeti.",
  alternates: { canonical: "/sepet/basarili" },
  robots: { index: false, follow: false },
};

interface CheckoutSuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

async function getCheckoutSummary(sessionId?: string) {
  if (!sessionId) {
    return null;
  }

  const payments = await db.payment.findMany({
    where: { transactionId: sessionId },
    include: {
      invoice: {
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (payments.length === 0) {
    return null;
  }

  const invoices = payments.map((payment) => payment.invoice);
  const orders = invoices
    .map((invoice) => invoice.order)
    .filter((order): order is NonNullable<typeof order> => Boolean(order));
  const totalAmount = toNumber(sum(invoices.map((invoice) => invoice.totalAmount)));

  return {
    sessionId,
    invoices,
    orders,
    totalAmount,
  };
}

export default async function CheckoutSuccessPage({ searchParams }: CheckoutSuccessPageProps) {
  const { session_id: sessionId } = await searchParams;
  const summary = await getCheckoutSummary(sessionId);

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <CheckoutHeader
          align="center"
          icon={<CheckCircle2 aria-hidden className="size-6 text-foreground" />}
          eyebrow="Ödeme"
          title="Ödemeniz alındı"
          description="Teşekkürler. Fatura ve hizmet durumunuz birkaç saniye içinde güncellenir; hizmetlerinizi müşteri panelinden takip edebilirsiniz."
        />
        <Section spacing="sm" container="narrow">
          <div className="mx-auto max-w-2xl space-y-8">
            {summary ? (
              <section aria-labelledby="odeme-ozeti" className="overflow-hidden rounded-2xl border bg-background">
                <div className="flex items-center gap-2 border-b px-5 py-4">
                  <Receipt aria-hidden className="size-4 text-muted-foreground" />
                  <h2 id="odeme-ozeti" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Ödeme özeti
                  </h2>
                </div>
                <ul className="divide-y divide-dashed px-5 text-sm">
                  {summary.invoices.map((invoice) => (
                    <li key={invoice.id} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="font-medium">{invoice.invoiceNumber}</p>
                        {invoice.order && (
                          <p className="text-muted-foreground">Sipariş: {invoice.order.orderNumber}</p>
                        )}
                      </div>
                      <p className="shrink-0 font-medium tabular-nums">{formatPrice(invoice.totalAmount)}</p>
                    </li>
                  ))}
                </ul>
                <div className="flex items-baseline justify-between gap-4 border-t bg-muted/30 px-5 py-4">
                  <span className="font-medium">Toplam</span>
                  <span className="text-xl font-semibold tabular-nums tracking-tight">
                    {formatPrice(summary.totalAmount)}
                  </span>
                </div>
                <p className="break-all border-t px-5 py-3 font-mono text-[11px] text-muted-foreground">
                  Oturum referansı: {summary.sessionId}
                </p>
              </section>
            ) : (
              <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Ödeme detayları henüz yüklenemedi. Birkaç saniye sonra müşteri panelinden faturalarınızı
                kontrol edebilirsiniz.
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/musteri/panel/faturalar" className={buttonClasses()}>
                <FileText aria-hidden className="size-4" />
                Faturalarım
              </Link>
              <Link href="/musteri/panel/hizmetlerim" className={buttonClasses({ variant: "outline" })}>
                <Package aria-hidden className="size-4" />
                Hizmetlerim
              </Link>
            </div>
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
