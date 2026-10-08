import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ShoppingCart, XCircle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Topbar } from "@/components/layout/topbar";
import { buttonClasses } from "@/components/site/button-classes";
import { Section } from "@/components/site/section";
import { StatusDot } from "@/components/site/status-pill";
import { CheckoutHeader } from "@/components/site/hosting/checkout-header";
import { formatTRY } from "@/lib/format/price";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getKuveytTurkFailureMessage } from "@/lib/integrations/payment-gateways/providers/kuveytturk-flow";

const formatPrice = (price: number | string | { toString(): string }) =>
  formatTRY(Number(price), { keepDecimals: true });

export const metadata: Metadata = {
  title: "Ödeme Tamamlanmadı",
  description: "Ödemeniz tamamlanmadı; sepetinize dönerek yeniden deneyebilirsiniz.",
  alternates: { canonical: "/sepet/iptal" },
  robots: { index: false, follow: false },
};

interface CheckoutCancelPageProps {
  searchParams: Promise<{ invoice_ids?: string; ref?: string; durum?: string }>;
}

function parseInvoiceIds(value?: string) {
  return (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

async function getCancelledCheckoutSummary(invoiceIds: string[]) {
  if (invoiceIds.length === 0) {
    return null;
  }

  const invoices = await db.invoice.findMany({
    where: { id: { in: invoiceIds } },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (invoices.length === 0) {
    return null;
  }

  const totalAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);

  return {
    invoices,
    totalAmount,
  };
}

export default async function CheckoutCancelPage({ searchParams }: CheckoutCancelPageProps) {
  const { invoice_ids: invoiceIdsParam, ref, durum } = await searchParams;
  const invoiceIds = parseInvoiceIds(invoiceIdsParam);
  const summary = await getCancelledCheckoutSummary(invoiceIds);
  const underReview = durum === "inceleme";
  const bankMessage = ref
    ? await getKuveytTurkFailureMessage({ merchantOrderId: ref }, (await auth())?.user?.id)
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <CheckoutHeader
          align="center"
          icon={<XCircle aria-hidden className="size-6 text-muted-foreground" />}
          eyebrow="Ödeme"
          title={underReview ? "Ödemeniz kontrol ediliyor" : "Ödeme tamamlanmadı"}
          description={
            underReview
              ? "Ödemeniz bankadan onay bekliyor veya kontrol ediliyor. Kartınızdan çekim yapıldıysa ekibimiz faturanızı kısa sürede güncelleyecek; tekrar ödeme yapmayın."
              : "Ödeme oturumu iptal edildi. Faturalarım sayfasından tekrar deneyebilir veya farklı bir ödeme yöntemi seçebilirsiniz."
          }
        />
        <Section spacing="sm" container="narrow">
          <div className="mx-auto max-w-2xl space-y-8">
            {bankMessage ? (
              <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                Banka yanıtı: {bankMessage}
              </p>
            ) : null}
            {summary ? (
              <section aria-labelledby="bekleyen-kayitlar" className="overflow-hidden rounded-2xl border bg-background">
                <div className="flex items-center gap-2 border-b px-5 py-4">
                  <FileText aria-hidden className="size-4 text-muted-foreground" />
                  <h2 id="bekleyen-kayitlar" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Bekleyen kayıtlar
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
                        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <StatusDot tone="neutral" />
                          Ödeme bekleniyor
                        </p>
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
              </section>
            ) : (
              <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                İptal edilen ödeme için kayıt bulunamadı. Sepetinizden yeniden ödeme başlatabilirsiniz.
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/sepet" className={buttonClasses()}>
                <ShoppingCart aria-hidden className="size-4" />
                Sepete dön
              </Link>
              <Link href="/musteri/panel/faturalar" className={buttonClasses({ variant: "outline" })}>
                Faturalarım
              </Link>
            </div>
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
