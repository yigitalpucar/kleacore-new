import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, FileText, IdCard, LogIn, Package, Receipt } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Topbar } from "@/components/layout/topbar";
import { buttonClasses } from "@/components/site/button-classes";
import { Section } from "@/components/site/section";
import { StatusDot } from "@/components/site/status-pill";
import { CheckoutHeader } from "@/components/site/hosting/checkout-header";
import { CheckoutSteps } from "@/components/checkout/checkout-steps";
import { AutoRefresh } from "@/components/checkout/auto-refresh";
import { formatTRY } from "@/lib/format/price";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sum, toNumber } from "@/lib/money";
import { servicePanelLink } from "@/lib/checkout/result-links";
import { cn } from "@/lib/utils";

const formatPrice = (price: number | string | { toString(): string }) =>
  formatTRY(Number(price), { keepDecimals: true });

export const metadata: Metadata = {
  title: "Ödeme Alındı",
  description: "Ödemenizin durumu ve fatura özeti.",
  alternates: { canonical: "/sepet/basarili" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface CheckoutSuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

async function getCheckoutSummary(sessionId: string | undefined, customerId: string | undefined) {
  if (!sessionId || !customerId) {
    return null;
  }

  // Only the customer who paid sees the invoices of a payment session.
  const payments = await db.payment.findMany({
    where: { transactionId: sessionId, customerId },
    include: {
      invoice: {
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              domain: true,
              provisioningHoldReasons: true,
              product: { select: { name: true, category: { select: { slug: true } } } },
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
    totalAmount,
    allPaid: invoices.every((invoice) => invoice.status === "PAID"),
    // Paid server orders waiting for identity verification (docs/fraud-kyc.md).
    kycRequired: orders.some((order) => order.provisioningHoldReasons.includes("KYC")),
    panelLinks: Array.from(
      new Map(
        orders.map((order) => {
          const link = servicePanelLink(order.product.category.slug);
          return [link.href, link];
        })
      ).values()
    ),
  };
}

function NextStep({
  index,
  title,
  done,
  children,
}: {
  index: number;
  title: string;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      <span
        aria-hidden
        className="absolute left-[13px] top-8 h-[calc(100%-2rem)] border-l border-dashed last:hidden"
      />
      <span
        aria-hidden
        className={cn(
          "relative flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]",
          done ? "border-foreground bg-foreground text-background" : "bg-background"
        )}
      >
        {done ? <CheckCircle2 className="size-4" /> : index}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="font-medium">
          {title}
          {done ? <span className="sr-only"> (tamamlandı)</span> : null}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

export default async function CheckoutSuccessPage({ searchParams }: CheckoutSuccessPageProps) {
  const { session_id: sessionId } = await searchParams;
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);
  const summary = await getCheckoutSummary(sessionId, session?.user?.id);
  const waiting = summary ? !summary.allPaid : false;
  const primaryLink = summary?.panelLinks.length === 1 ? summary.panelLinks[0] : servicePanelLink(null);

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <CheckoutHeader
          align="center"
          steps={<CheckoutSteps current="onay" allComplete={!waiting} />}
          icon={
            waiting ? (
              <Clock aria-hidden className="size-6 text-foreground" />
            ) : (
              <CheckCircle2 aria-hidden className="size-6 text-foreground" />
            )
          }
          eyebrow="Ödeme"
          title={waiting ? "Ödemeniz işleniyor" : "Ödemeniz alındı"}
          description={
            waiting
              ? "Bankanızdan onay bekleniyor. Bu sayfa birkaç saniyede bir kendiliğinden güncellenir; tekrar ödeme yapmayın."
              : "Teşekkürler. Siparişiniz onaylandı ve hizmetleriniz hazırlanıyor."
          }
        />
        <Section spacing="sm" container="narrow">
          <AutoRefresh active={waiting} />
          <div className="mx-auto max-w-2xl space-y-6">
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
                    <li key={invoice.id} className="flex items-start justify-between gap-4 py-4">
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
                          {invoice.status === "PAID" ? "Ödendi" : "Onay bekleniyor"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <p className="font-medium tabular-nums">{formatPrice(invoice.totalAmount)}</p>
                        <Link
                          href={`/musteri/panel/faturalar/${invoice.id}`}
                          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Faturayı görüntüle
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex items-baseline justify-between gap-4 border-t bg-muted/30 px-5 py-4">
                  <span className="font-medium">
                    Toplam <span className="text-xs font-normal text-muted-foreground">KDV dahil</span>
                  </span>
                  <span className="text-xl font-semibold tabular-nums tracking-tight">
                    {formatPrice(summary.totalAmount)}
                  </span>
                </div>
                <p className="break-all border-t px-5 py-3 font-mono text-[11px] text-muted-foreground">
                  Ödeme referansı: {summary.sessionId}
                </p>
              </section>
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {signedIn ? (
                  <p>
                    Ödeme ayrıntıları henüz yüklenemedi. Birkaç saniye sonra müşteri panelindeki faturalarınızdan
                    durumu kontrol edebilirsiniz.
                  </p>
                ) : (
                  <>
                    <p>Ödeme ayrıntılarını görmek için müşteri hesabınızla giriş yapın.</p>
                    <Link
                      href={`/musteri/giris?callbackUrl=${encodeURIComponent(
                        sessionId ? `/sepet/basarili?session_id=${sessionId}` : "/musteri/panel/faturalar"
                      )}`}
                      className={buttonClasses({ variant: "outline", className: "mt-4" })}
                    >
                      <LogIn aria-hidden className="size-4" />
                      Giriş yap
                    </Link>
                  </>
                )}
              </div>
            )}

            {summary?.kycRequired ? (
              <section
                role="status"
                aria-labelledby="kyc-gerekli"
                className="flex items-start gap-3 rounded-2xl border border-foreground/30 bg-background p-5"
              >
                <IdCard aria-hidden className="mt-0.5 size-5 shrink-0" />
                <div className="min-w-0 space-y-3">
                  <h2 id="kyc-gerekli" className="font-semibold">
                    Kimlik doğrulaması gerekli
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Sunucu hizmetinizin kurulumu, 5651 sayılı Kanun gereği kimliğiniz doğrulandıktan sonra başlar.
                    Belgelerinizi yükleyin; onaylandığında kurulum kendiliğinden başlar.
                  </p>
                  <Link href="/musteri/panel/kimlik-dogrulama" className={buttonClasses()}>
                    Kimlik belgelerini yükle
                  </Link>
                </div>
              </section>
            ) : null}

            <section aria-labelledby="sirada-ne-var" className="rounded-2xl border bg-background p-5">
              <h2 id="sirada-ne-var" className="mb-5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Sırada ne var?
              </h2>
              <ol>
                <NextStep index={1} title="Ödeme onayı" done={Boolean(summary?.allPaid)}>
                  {summary?.allPaid
                    ? "Ödemeniz alındı ve faturalarınız ödendi olarak işaretlendi. Faturalarınızı müşteri panelinden indirebilirsiniz."
                    : "Banka onayı geldiğinde faturalarınız ödendi olarak işaretlenir. Kartınızdan çekim yapıldıysa tekrar ödeme yapmayın."}
                </NextStep>
                <NextStep index={2} title="Kurulum">
                  {summary?.kycRequired
                    ? "Sunucu siparişlerinizin kurulumu kimlik doğrulamanız onaylandıktan sonra başlar; diğer hizmetleriniz hazırlanır."
                    : "Ödeme onaylandıktan sonra hizmetlerinizin kurulumu ve alan adı kayıtlarınız başlatılır."}
                </NextStep>
                <NextStep index={3} title="Bilgilendirme">
                  Hizmetiniz kullanıma hazır olduğunda e-posta ile bilgilendirilirsiniz. Durumu müşteri panelinden
                  izleyebilir, sorunuz olursa destek talebi açabilirsiniz.
                </NextStep>
              </ol>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href={primaryLink.href} className={buttonClasses()}>
                <Package aria-hidden className="size-4" />
                {primaryLink.label}
              </Link>
              <Link href="/musteri/panel/faturalar" className={buttonClasses({ variant: "outline" })}>
                <FileText aria-hidden className="size-4" />
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
