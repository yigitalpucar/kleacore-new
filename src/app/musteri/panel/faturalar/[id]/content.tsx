"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  ArrowLeft,
  Download,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Printer,
  Calendar,
  Building,
  Receipt,
  Tag,
  Mail,
  Banknote,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getCustomerEInvoiceBadgeClass,
  getCustomerEInvoiceLabel,
} from "@/lib/efatura/customer-status";
import type { EInvoiceStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { handleCreditCardCheckoutRedirect } from "@/lib/payments/checkout-redirect";
import {
  payInvoice,
  sendInvoiceCopy,
} from "@/lib/actions/customer/invoices";
import { toast } from "@/lib/toast";
import {
  CUSTOMER_PAYMENT_METHOD_OPTIONS,
  type CustomerPaymentMethod,
} from "@/lib/payments/methods";

const statusConfig = {
  PAID: {
    label: "Ödendi",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    icon: CheckCircle2,
  },
  PENDING: {
    label: "Ödeme Bekliyor",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    icon: Clock,
  },
  OVERDUE: {
    label: "Gecikmiş",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    icon: AlertCircle,
  },
  CANCELLED: {
    label: "İptal Edildi",
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/30",
    icon: XCircle,
  },
  DRAFT: {
    label: "Taslak",
    color: "text-gray-400",
    bgColor: "bg-gray-400/10",
    borderColor: "border-gray-400/30",
    icon: FileText,
  },
};

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

interface SerializedInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  issuedAt: string;
  dueDate: string;
  paidAt: string | null;
  notes: string | null;
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  payments: {
    id: string;
    amount: number;
    method: string;
    status: string;
    transactionId: string | null;
    paidAt: string | null;
  }[];
  customer: {
    id: string;
    name: string;
    surname: string;
    email: string;
    phone: string | null;
    companyName: string | null;
    taxNumber: string | null;
    taxOffice: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
  };
  order: {
    id: string;
    orderNumber: string;
  } | null;
  eInvoice: {
    status: string;
    type: string;
    documentNumber: string | null;
    sentAt: string | null;
    errorMessage: string | null;
  } | null;
}

interface FaturaDetayContentProps {
  invoice: SerializedInvoice;
}

const paymentMethodLabels: Record<string, string> = {
  CREDIT_CARD: "Kredi Kartı",
  BANK_TRANSFER: "Banka Havalesi",
  BALANCE: "Bakiye",
};

export function FaturaDetayContent({ invoice }: FaturaDetayContentProps) {
  const router = useRouter();
  const status = statusConfig[invoice.status as keyof typeof statusConfig] ?? statusConfig.DRAFT;
  const StatusIcon = status.icon;
  const canPay = invoice.status === "PENDING" || invoice.status === "OVERDUE";
  const description = invoice.items[0]?.description ?? invoice.invoiceNumber;
  const lastPayment = invoice.payments[0];
  const invoicePdfUrl = `/api/faturalar/${invoice.id}/pdf`;
  const [isPaying, setIsPaying] = useState(false);
  const [isSendingCopy, setIsSendingCopy] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<CustomerPaymentMethod>("CREDIT_CARD");

  const handlePayInvoice = async () => {
    if (isPaying) return;
    setIsPaying(true);

    const result = await payInvoice({
      invoiceId: invoice.id,
      paymentMethod,
    });

    if (!result.success) {
      toast.error(result.error ?? "Ödeme tamamlanamadı");
      setIsPaying(false);
      return;
    }

    if (
      result.data &&
      handleCreditCardCheckoutRedirect(
        {
          checkoutUrl: result.data.checkoutUrl,
          checkoutHtml: result.data.checkoutHtml,
          paytrToken: result.data.paytrToken,
        },
        router
      )
    ) {
      return;
    }

    toast.success(result.message ?? "Ödeme tamamlandı");
    router.refresh();
    setIsPaying(false);
  };

  const handleSendInvoiceCopy = async () => {
    if (isSendingCopy) return;
    setIsSendingCopy(true);

    const result = await sendInvoiceCopy(invoice.id);
    if (!result.success) {
      toast.error(result.error ?? "Fatura özeti gönderilemedi");
      setIsSendingCopy(false);
      return;
    }

    toast.success(result.message ?? "Fatura özeti gönderildi");
    setIsSendingCopy(false);
  };

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col gap-4">
          <Link
            href="/musteri/panel/faturalar"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Faturalara Dön
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={cn("p-4 rounded-xl", status.bgColor)}>
                <FileText className={cn("h-8 w-8", status.color)} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight">{invoice.invoiceNumber}</h1>
                  <span className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                    status.bgColor, status.color
                  )}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>
                  {invoice.status === "PAID" && invoice.eInvoice && (
                    <Badge
                      variant="outline"
                      className={getCustomerEInvoiceBadgeClass(
                        invoice.eInvoice.status as EInvoiceStatus
                      )}
                    >
                      {getCustomerEInvoiceLabel(
                        invoice.eInvoice.status as EInvoiceStatus,
                        invoice.eInvoice.type as "e-fatura" | "e-arsiv"
                      )}
                    </Badge>
                  )}
                </div>
                {invoice.status === "PAID" && invoice.eInvoice?.documentNumber && (
                  <p className="text-sm text-muted-foreground mt-2">
                    E-belge no: {invoice.eInvoice.documentNumber}
                    {invoice.eInvoice.sentAt
                      ? ` · ${new Date(invoice.eInvoice.sentAt).toLocaleDateString("tr-TR")}`
                      : ""}
                  </p>
                )}
                <p className="text-muted-foreground mt-1">{description}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Oluşturulma: {new Date(invoice.issuedAt).toLocaleDateString("tr-TR")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Son Ödeme: {new Date(invoice.dueDate).toLocaleDateString("tr-TR")}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(invoicePdfUrl, "_blank")}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" />
              </Button>
              {canPay && (
                <Button onClick={handlePayInvoice} disabled={isPaying}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {isPaying
                    ? "İşleniyor..."
                    : paymentMethod === "BANK_TRANSFER"
                      ? "Havale Bildir"
                      : "Şimdi Öde"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </BlurFade>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Items */}
          <BlurFade delay={0.15} inView>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Fatura Kalemleri
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {invoice.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{item.description}</p>
                          {item.quantity > 1 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.quantity} x {currencyFormatter.format(item.unitPrice)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{currencyFormatter.format(item.totalPrice)}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Totals */}
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Ara Toplam</span>
                      <span>{currencyFormatter.format(invoice.subtotal)}</span>
                    </div>
                    {invoice.taxAmount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">KDV (%{invoice.taxRate})</span>
                        <span>{currencyFormatter.format(invoice.taxAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>Toplam</span>
                      <span className={status.color}>{currencyFormatter.format(invoice.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </BlurFade>

          {/* Payment Info - Only for paid invoices */}
          {invoice.status === "PAID" && lastPayment && (
            <BlurFade delay={0.2} inView>
              <Card className="border-green-500/30 bg-green-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-500">
                    <CheckCircle2 className="h-5 w-5" />
                    Ödeme Bilgileri
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <Banknote className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Ödeme Yöntemi</p>
                        <p className="font-medium">{paymentMethodLabels[lastPayment.method] ?? lastPayment.method}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Ödeme Tarihi</p>
                        <p className="font-medium">
                          {invoice.paidAt
                            ? new Date(invoice.paidAt).toLocaleDateString("tr-TR")
                            : "-"}
                        </p>
                      </div>
                    </div>
                    {lastPayment.transactionId && (
                      <div className="flex items-center gap-3 sm:col-span-2">
                        <Tag className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">İşlem Numarası</p>
                          <p className="font-mono text-sm">{lastPayment.transactionId}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </BlurFade>
          )}

          {/* Overdue Warning */}
          {invoice.status === "OVERDUE" && (
            <BlurFade delay={0.2} inView>
              <Card className="border-red-500/30 bg-red-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-500">Ödeme Gecikmiş</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Bu faturanın son ödeme tarihi geçmiştir. Hizmetinizin askıya alınmaması için
                        lütfen en kısa sürede ödemenizi gerçekleştirin.
                      </p>
                      <Button className="mt-3" size="sm" onClick={handlePayInvoice} disabled={isPaying}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        {isPaying ? "Ödeniyor..." : "Hemen Öde"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </BlurFade>
          )}

          {/* Billing Info */}
          <BlurFade delay={0.25} inView>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" />
                  Fatura Adresi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="font-semibold">
                      {invoice.customer.name} {invoice.customer.surname}
                    </p>
                    {invoice.customer.companyName && (
                      <p className="text-sm text-muted-foreground">{invoice.customer.companyName}</p>
                    )}
                    {invoice.customer.address && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {invoice.customer.address}
                      </p>
                    )}
                    {(invoice.customer.city || invoice.customer.country) && (
                      <p className="text-sm text-muted-foreground">
                        {[invoice.customer.city, invoice.customer.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                  <div>
                    {invoice.customer.taxNumber && (
                      <div className="mb-2">
                        <p className="text-xs text-muted-foreground">Vergi No</p>
                        <p className="font-medium">{invoice.customer.taxNumber}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">E-posta</p>
                      <p className="font-medium">{invoice.customer.email}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Invoice Summary */}
          <BlurFade delay={0.3} inView>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fatura Özeti</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fatura No</span>
                    <span className="font-medium">{invoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Oluşturulma</span>
                    <span className="font-medium">{new Date(invoice.issuedAt).toLocaleDateString("tr-TR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Son Ödeme</span>
                    <span className="font-medium">{new Date(invoice.dueDate).toLocaleDateString("tr-TR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Durum</span>
                    <span className={cn("font-medium", status.color)}>{status.label}</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t">
                    <span className="font-medium">Toplam</span>
                    <span className="text-xl font-bold">{currencyFormatter.format(invoice.totalAmount)}</span>
                  </div>
                </div>

                {canPay && (
                  <div className="space-y-3 pt-2">
                    <p className="text-sm font-medium">Ödeme Yöntemi</p>
                    <div className="grid gap-2">
                      {CUSTOMER_PAYMENT_METHOD_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setPaymentMethod(option.value)}
                          className={cn(
                            "rounded-lg border p-3 text-left transition-colors",
                            paymentMethod === option.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/40"
                          )}
                        >
                          <p className="text-sm font-medium">{option.label}</p>
                          <p className="text-xs text-muted-foreground">{option.description}</p>
                        </button>
                      ))}
                    </div>
                    <Button className="w-full" size="lg" onClick={handlePayInvoice} disabled={isPaying}>
                      <CreditCard className="mr-2 h-4 w-4" />
                      {isPaying
                        ? "İşleniyor..."
                        : paymentMethod === "BANK_TRANSFER"
                          ? "Havale Bildir"
                          : "Ödeme Yap"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </BlurFade>

          {/* Related Order */}
          {invoice.order && (
            <BlurFade delay={0.35} inView>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">İlgili Sipariş</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <FileText className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">{invoice.order.orderNumber}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </BlurFade>
          )}

          {/* Actions */}
          <BlurFade delay={0.4} inView>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">İşlemler</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.open(invoicePdfUrl, "_blank")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  PDF İndir
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.print()}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Yazdır
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleSendInvoiceCopy}
                  disabled={isSendingCopy}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {isSendingCopy ? "Gönderiliyor..." : "E-posta Gönder"}
                </Button>
              </CardContent>
            </Card>
          </BlurFade>

          {/* Help */}
          <BlurFade delay={0.45} inView>
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Ödeme Sorunları</p>
                    <p>
                      Fatura ile ilgili sorun yaşıyorsanız destek ekibimize ulaşabilirsiniz.
                    </p>
                    <Button variant="link" className="h-auto p-0 mt-2" asChild>
                      <Link href="/musteri/panel/destek">
                        Destek Talebi Oluştur
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
