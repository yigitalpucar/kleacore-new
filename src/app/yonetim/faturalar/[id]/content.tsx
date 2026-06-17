"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Mail,
  CheckCircle,
  Printer,
  CreditCard,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import {
  markPaid,
  approveBankTransfer,
  cancelInvoice,
  sendInvoiceReminder,
  sendInvoiceReceipt,
} from "@/lib/actions/admin/invoices";
import { toast } from "@/lib/toast";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
  notes: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: string;
  createdAt: Date;
  dueDate: Date;
  paidAt: Date | null;
  notes: string | null;
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
  order: { id: string; orderNumber: string } | null;
  items: InvoiceItem[];
  payments: Payment[];
}

interface InvoiceDetailContentProps {
  invoice: Invoice;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  PAID: { label: "Ödendi", color: "bg-green-500/10 text-green-600 dark:text-green-500", icon: CheckCircle },
  PENDING: { label: "Bekliyor", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500", icon: Clock },
  OVERDUE: { label: "Gecikmiş", color: "bg-red-500/10 text-red-600 dark:text-red-500", icon: AlertTriangle },
  CANCELLED: { label: "İptal", color: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-500", icon: XCircle },
  DRAFT: { label: "Taslak", color: "bg-blue-500/10 text-blue-600 dark:text-blue-500", icon: FileText },
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(price);
};

const paymentMethodLabels: Record<string, string> = {
  CREDIT_CARD: "Kredi Kartı",
  BANK_TRANSFER: "Banka Havalesi",
  BALANCE: "Bakiye",
};

export function InvoiceDetailContent({ invoice }: InvoiceDetailContentProps) {
  const config = statusConfig[invoice.status] || statusConfig.DRAFT;
  const StatusIcon = config.icon;
  const fullName = `${invoice.customer.name} ${invoice.customer.surname}`;
  const initials = `${invoice.customer.name[0] || ""}${invoice.customer.surname[0] || ""}`;
  const hasPendingBankTransfer = invoice.payments.some(
    (payment) => payment.method === "BANK_TRANSFER" && payment.status === "PENDING"
  );

  const handleApproveBankTransfer = async () => {
    const result = await approveBankTransfer(invoice.id);
    if (!result.success) {
      toast.error(result.error ?? "Banka transferi onaylanamadı");
      return;
    }
    toast.success("Banka transferi onaylandı ve sipariş işleme alındı");
  };

  const handleMarkPaid = async () => {
    const result = await markPaid(invoice.id);
    if (!result.success) {
      toast.error(result.error ?? "Fatura durumu güncellenemedi");
      return;
    }
    toast.success("Fatura ödendi olarak işaretlendi");
  };

  const handleCancelInvoice = async () => {
    const result = await cancelInvoice(invoice.id);
    if (!result.success) {
      toast.error(result.error ?? "Fatura iptal edilemedi");
      return;
    }
    toast.success("Fatura iptal edildi");
  };

  const handleSendMail = async () => {
    const action =
      invoice.status === "PAID" ? sendInvoiceReceipt : sendInvoiceReminder;
    const result = await action(invoice.id);
    if (!result.success) {
      toast.error(result.error ?? "E-posta gönderilemedi");
      return;
    }
    toast.success(
      result.message ??
        (invoice.status === "PAID" ? "Makbuz gönderildi" : "Hatırlatma gönderildi")
    );
  };

  return (
    <div className="space-y-6">
      <Link
        href="/yonetim/faturalar"
        className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Faturalara Dön
      </Link>

      <BlurFade delay={0}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Fatura {invoice.invoiceNumber}</h1>
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                config.color
              )}>
                <StatusIcon className="h-3.5 w-3.5" />
                {config.label}
              </span>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400">
              Oluşturulma: {new Date(invoice.createdAt).toLocaleDateString("tr-TR")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              onClick={() => window.print()}
            >
              <Printer className="mr-2 h-4 w-4" />
              Yazdır
            </Button>
            <Button
              variant="outline"
              className="bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              onClick={() => window.open(`/api/faturalar/${invoice.id}/pdf`, "_blank")}
            >
              <Download className="mr-2 h-4 w-4" />
              PDF İndir
            </Button>
            <Button
              variant="outline"
              className="bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              onClick={handleSendMail}
            >
              <Mail className="mr-2 h-4 w-4" />
              E-posta Gönder
            </Button>
            {(invoice.status === "PENDING" || invoice.status === "OVERDUE") && (
              <>
                {hasPendingBankTransfer ? (
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleApproveBankTransfer}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Ödemeyi Onayla
                  </Button>
                ) : (
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleMarkPaid}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Ödendi İşaretle
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-500 dark:hover:bg-red-950"
                  onClick={handleCancelInvoice}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  İptal Et
                </Button>
              </>
            )}
          </div>
        </div>
      </BlurFade>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BlurFade delay={0.1}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardContent className="p-6">
                <div className="flex justify-between mb-8">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">KLEACORE</h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">30 N Gould St Ste R</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Sheridan, WY 82801, USA</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">EIN: 36-5157418</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">FATURA</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">No: {invoice.invoiceNumber}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Tarih: {new Date(invoice.createdAt).toLocaleDateString("tr-TR")}
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Son Ödeme: {new Date(invoice.dueDate).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                </div>

                <div className="mb-8 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/50">
                  <p className="text-sm text-zinc-500 mb-2">Fatura Adresi</p>
                  <p className="text-zinc-900 dark:text-white font-medium">{fullName}</p>
                  {invoice.customer.companyName && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{invoice.customer.companyName}</p>
                  )}
                  {invoice.customer.address && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {invoice.customer.address}{invoice.customer.city ? `, ${invoice.customer.city}` : ""}
                    </p>
                  )}
                  {invoice.customer.taxNumber && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Vergi No: {invoice.customer.taxNumber}</p>
                  )}
                </div>

                <div className="mb-8">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800">
                        <th className="text-left py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Açıklama</th>
                        <th className="text-center py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Adet</th>
                        <th className="text-right py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Birim Fiyat</th>
                        <th className="text-right py-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Toplam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item) => (
                        <tr key={item.id} className="border-b border-zinc-200 dark:border-zinc-800">
                          <td className="py-4">
                            <p className="text-sm text-zinc-900 dark:text-white">{item.description}</p>
                          </td>
                          <td className="py-4 text-center text-sm text-zinc-700 dark:text-zinc-300">{item.quantity}</td>
                          <td className="py-4 text-right text-sm text-zinc-700 dark:text-zinc-300">
                            {formatPrice(item.unitPrice)}
                          </td>
                          <td className="py-4 text-right text-sm font-medium text-zinc-900 dark:text-white">
                            {formatPrice(item.totalPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-600 dark:text-zinc-400">Ara Toplam</span>
                      <span className="text-zinc-700 dark:text-zinc-300">{formatPrice(invoice.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-600 dark:text-zinc-400">KDV (%{invoice.taxRate})</span>
                      <span className="text-zinc-700 dark:text-zinc-300">{formatPrice(invoice.taxAmount)}</span>
                    </div>
                    <Separator className="bg-zinc-200 dark:bg-zinc-800" />
                    <div className="flex justify-between">
                      <span className="font-medium text-zinc-900 dark:text-white">Toplam</span>
                      <span className="text-xl font-bold text-zinc-900 dark:text-white">{formatPrice(invoice.totalAmount)}</span>
                    </div>
                  </div>
                </div>

                {invoice.notes && (
                  <div className="mt-8 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/50">
                    <p className="text-sm text-zinc-500 mb-1">Not</p>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{invoice.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </BlurFade>
        </div>

        <div className="space-y-6">
          <BlurFade delay={0.15}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base">Fatura Bilgileri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-500">Durum</span>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
                    config.color
                  )}>
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-500">Oluşturulma</span>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {new Date(invoice.createdAt).toLocaleDateString("tr-TR")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-500">Son Ödeme</span>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {new Date(invoice.dueDate).toLocaleDateString("tr-TR")}
                  </span>
                </div>
                {invoice.paidAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-600 dark:text-zinc-500">Ödeme Tarihi</span>
                    <span className="text-sm text-green-600 dark:text-green-500">
                      {new Date(invoice.paidAt).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                )}
                {invoice.order && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-600 dark:text-zinc-500">Sipariş</span>
                    <Link href={`/yonetim/siparisler/${invoice.order.id}`} className="text-sm text-primary hover:underline">
                      {invoice.order.orderNumber}
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </BlurFade>

          <BlurFade delay={0.2}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base">Müşteri</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/yonetim/musteriler/${invoice.customer.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white text-sm font-medium">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{fullName}</p>
                    <p className="text-xs text-zinc-500">{invoice.customer.email}</p>
                  </div>
                </Link>
              </CardContent>
            </Card>
          </BlurFade>

          <BlurFade delay={0.25}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base">Ödeme Geçmişi</CardTitle>
              </CardHeader>
              <CardContent>
                {invoice.payments.length > 0 ? (
                  <div className="space-y-4">
                    {invoice.payments.map((payment) => (
                      <div key={payment.id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/50">
                        <CreditCard className="h-5 w-5 text-green-500 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">
                              {formatPrice(payment.amount)}
                            </span>
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                              payment.status === "COMPLETED"
                                ? "bg-green-500/10 text-green-600 dark:text-green-500"
                                : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500"
                            )}>
                              {payment.status === "COMPLETED" ? "Başarılı" : "Bekliyor"}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                            {paymentMethodLabels[payment.method] ?? payment.method}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {new Date(payment.createdAt).toLocaleDateString("tr-TR")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 text-center py-4">Henüz ödeme yapılmadı</p>
                )}
              </CardContent>
            </Card>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
