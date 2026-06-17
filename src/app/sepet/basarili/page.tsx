import Link from "next/link";
import { CheckCircle2, FileText, Package, Receipt } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { db } from "@/lib/db";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(price);

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
  const totalAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);

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
      <main className="flex-1 bg-background py-16">
        <div className="container max-w-2xl">
          <Card>
            <CardHeader className="text-center">
              <CheckCircle2 className="mx-auto mb-2 h-14 w-14 text-primary" />
              <CardTitle className="text-2xl">Ödeme alındı</CardTitle>
              <CardDescription>
                Stripe ödemeniz tamamlandı. Fatura ve hizmet durumunuz birkaç saniye içinde
                güncellenir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {summary ? (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                    <Receipt className="h-4 w-4 text-primary" />
                    Ödeme Özeti
                  </div>
                  <div className="space-y-3 text-sm">
                    {summary.invoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium">{invoice.invoiceNumber}</p>
                          {invoice.order && (
                            <p className="text-muted-foreground">
                              Sipariş: {invoice.order.orderNumber}
                            </p>
                          )}
                        </div>
                        <p className="font-medium">{formatPrice(invoice.totalAmount)}</p>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex items-center justify-between font-semibold">
                      <span>Toplam</span>
                      <span>{formatPrice(summary.totalAmount)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Oturum referansı: {summary.sessionId}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Ödeme detayları henüz yüklenemedi. Birkaç saniye sonra müşteri panelinden
                  faturalarınızı kontrol edebilirsiniz.
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button asChild>
                  <Link href="/musteri/panel/faturalar">
                    <FileText className="mr-2 h-4 w-4" />
                    Faturalarım
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/musteri/panel/hizmetlerim">
                    <Package className="mr-2 h-4 w-4" />
                    Hizmetlerim
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}