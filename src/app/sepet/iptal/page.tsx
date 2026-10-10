import type { Metadata } from "next";
import Link from "next/link";
import { Clock, FileText, Headphones, LogIn, RotateCcw, XCircle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Topbar } from "@/components/layout/topbar";
import { buttonClasses } from "@/components/site/button-classes";
import { Section } from "@/components/site/section";
import { StatusDot } from "@/components/site/status-pill";
import { CheckoutHeader } from "@/components/site/hosting/checkout-header";
import { CheckoutSteps } from "@/components/checkout/checkout-steps";
import { formatTRY } from "@/lib/format/price";
import { db } from "@/lib/db";
import { sum, toNumber } from "@/lib/money";
import { auth } from "@/lib/auth";
import { getKuveytTurkFailureMessage } from "@/lib/integrations/payment-gateways/providers/kuveytturk-flow";
import { parseInvoiceIds, retryPaymentHref } from "@/lib/checkout/result-links";

const formatPrice = (price: number | string | { toString(): string }) =>
  formatTRY(Number(price), { keepDecimals: true });

export const metadata: Metadata = {
  title: "Ödeme Tamamlanmadı",
  description: "Ödemeniz tamamlanmadı; faturanızdan yeniden deneyebilirsiniz.",
  alternates: { canonical: "/sepet/iptal" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface CheckoutCancelPageProps {
  searchParams: Promise<{ invoice_ids?: string; ref?: string; durum?: string }>;
}

async function getCancelledCheckoutSummary(invoiceIds: string[], customerId: string | undefined) {
  if (invoiceIds.length === 0 || !customerId) {
    return null;
  }

  // Only the customer's own invoices (the ids come from the URL).
  const invoices = await db.invoice.findMany({
    where: { id: { in: invoiceIds }, customerId },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          domain: true,
          product: { select: { name: true, category: { select: { slug: true } } } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (invoices.length === 0) {
    return null;
  }

  const open = invoices.filter((invoice) => invoice.status === "PENDING" || invoice.status === "OVERDUE");
  return {
    invoices,
    openInvoiceIds: open.map((invoice) => invoice.id),
    totalAmount: toNumber(sum(invoices.map((invoice) => invoice.totalAmount))),
  };
}

function invoiceStatusLabel(status: string) {
  if (status === "PAID") return "Ödendi";
  if (status === "CANCELLED") return "İptal edildi";
  return "Ödeme bekleniyor";
}

export default async function CheckoutCancelPage({ searchParams }: CheckoutCancelPageProps) {
  const { invoice_ids: invoiceIdsParam, ref, durum } = await searchParams;
  const session = await auth();
  const customerId = session?.user?.id;
  const invoiceIds = parseInvoiceIds(invoiceIdsParam);
  const summary = await getCancelledCheckoutSummary(invoiceIds, customerId);
  const underReview = durum === "inceleme";
  const bankMessage = ref ? await getKuveytTurkFailureMessage({ merchantOrderId: ref }, customerId) : null;
  const canRetry = !underReview && Boolean(summary && summary.openInvoiceIds.length > 0);

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <CheckoutHeader
          align="center"
          steps={<CheckoutSteps current="odeme" error={!underReview} />}
          icon={
            underReview ? (
              <Clock aria-hidden className="size-6 text-muted-foreground" />
            ) : (
              <XCircle aria-hidden className="size-6 text-muted-foreground" />
            )
          }
          eyebrow="Ödeme"
          title={underReview ? "Ödemeniz kontrol ediliyor" : "Ödeme tamamlanmadı"}
          description={
            underReview
              ? "Ödemeniz bankadan onay bekliyor veya kontrol ediliyor. Kartınızdan çekim yapıldıysa ekibimiz faturanızı kısa sürede güncelleyecek; tekrar ödeme yapmayın."
              : "Kartınızdan çekim yapılmadı. Siparişiniz faturalarınızda bekliyor; aynı veya farklı bir ödeme yöntemiyle yeniden deneyebilirsiniz."
          }
        />
        <Section spacing="sm" container="narrow">
          <div className="mx-auto max-w-2xl space-y-6">
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
                    Bekleyen faturalar
                  </h2>
                </div>
                <ul className="divide-y divide-dashed px-5 text-sm">
                  {summary.invoices.map((invoice) => {
                    const open = summary.openInvoiceIds.includes(invoice.id);
                    return (
                      <li key={invoice.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-4">
                        <div className="min-w-0">
                          <p className="break-words font-medium">
                            {invoice.order?.domain && invoice.order.product.category.slug === "domain"
                              ? invoice.order.domain
                              : (invoice.order?.product.name ?? invoice.invoiceNumber)}
                          </p>
                          <p className="text-muted-foreground">
                            Fatura {invoice.invoiceNumber}
                            {invoice.order ? ` · Sipariş ${invoice.order.orderNumber}` : null}
                          </p>
                          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <StatusDot tone={invoice.status === "PAID" ? "online" : "neutral"} pulse={false} />
                            {invoiceStatusLabel(invoice.status)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <p className="font-medium tabular-nums">{formatPrice(invoice.totalAmount)}</p>
                          {open && !underReview ? (
                            <Link
                              href={`/musteri/panel/faturalar/${invoice.id}`}
                              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              Bu faturayı öde
                            </Link>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-baseline justify-between gap-4 border-t bg-muted/30 px-5 py-4">
                  <span className="font-medium">
                    Toplam <span className="text-xs font-normal text-muted-foreground">KDV dahil</span>
                  </span>
                  <span className="text-xl font-semibold tabular-nums tracking-tight">
                    {formatPrice(summary.totalAmount)}
                  </span>
                </div>
              </section>
            ) : customerId ? (
              <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Bu ödeme için bekleyen fatura bulunamadı. Faturalarınızı müşteri panelinden kontrol edebilirsiniz.
              </p>
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                <p>Bekleyen faturalarınızı görmek için müşteri hesabınızla giriş yapın.</p>
                <Link
                  href="/musteri/giris?callbackUrl=%2Fmusteri%2Fpanel%2Ffaturalar"
                  className={buttonClasses({ variant: "outline", className: "mt-4" })}
                >
                  <LogIn aria-hidden className="size-4" />
                  Giriş yap
                </Link>
              </div>
            )}

            {!underReview ? (
              <section aria-labelledby="neden-olabilir" className="rounded-2xl border bg-background p-5 text-sm">
                <h2 id="neden-olabilir" className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Ne yapabilirsiniz?
                </h2>
                <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground marker:text-muted-foreground/60">
                  <li>Kart bilgilerinizi ve 3D Secure (SMS) doğrulamasını kontrol edip yeniden deneyin.</li>
                  <li>Kartınızın internet alışverişine ve tutar limitine uygun olduğundan emin olun.</li>
                  <li>Fatura sayfasından farklı bir kartla veya Havale/EFT ile ödeyebilirsiniz.</li>
                </ul>
              </section>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              {canRetry && summary ? (
                <Link href={retryPaymentHref(summary.openInvoiceIds)} className={buttonClasses()}>
                  <RotateCcw aria-hidden className="size-4" />
                  Ödemeyi tekrar dene
                </Link>
              ) : null}
              <Link
                href="/musteri/panel/faturalar"
                className={buttonClasses({ variant: canRetry ? "outline" : "primary" })}
              >
                <FileText aria-hidden className="size-4" />
                Faturalarım
              </Link>
              <Link href="/musteri/destek" className={buttonClasses({ variant: "ghost" })}>
                <Headphones aria-hidden className="size-4" />
                Destek
              </Link>
            </div>
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
