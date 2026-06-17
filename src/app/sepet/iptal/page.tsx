import Link from "next/link";
import { FileText, ShoppingCart, XCircle } from "lucide-react";
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

interface CheckoutCancelPageProps {
  searchParams: Promise<{ invoice_ids?: string }>;
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
  const { invoice_ids: invoiceIdsParam } = await searchParams;
  const invoiceIds = parseInvoiceIds(invoiceIdsParam);
  const summary = await getCancelledCheckoutSummary(invoiceIds);

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1 bg-background py-16">
        <div className="container max-w-2xl">
          <Card>
            <CardHeader className="text-center">
              <XCircle className="mx-auto mb-2 h-14 w-14 text-destructive" />
              <CardTitle className="text-2xl">Ödeme tamamlanmadı</CardTitle>
              <CardDescription>
                Stripe ödeme oturumu iptal edildi. Sepetinize dönerek tekrar deneyebilir veya
                farklı bir ödeme yöntemi seçebilirsiniz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {summary ? (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4 text-destructive" />
                    Bekleyen Kayıtlar
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
                          <p className="text-muted-foreground">Durum: Ödeme bekleniyor</p>
                        </div>
                        <p className="font-medium">{formatPrice(invoice.totalAmount)}</p>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex items-center justify-between font-semibold">
                      <span>Toplam</span>
                      <span>{formatPrice(summary.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  İptal edilen ödeme için kayıt bulunamadı. Sepetinizden yeniden ödeme
                  başlatabilirsiniz.
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button asChild>
                  <Link href="/sepet">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Sepete Dön
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/musteri/panel/faturalar">Faturalarım</Link>
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