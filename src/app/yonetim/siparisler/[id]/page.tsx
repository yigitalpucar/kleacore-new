import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Pause,
  Play,
  Edit,
  Mail,
  Package,
  User,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Server,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getOrderById } from "@/lib/dal/orders";
import { OrderDetailActions } from "./content";

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  PENDING: { label: "Beklemede", color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  APPROVED: { label: "Onaylandı", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  PROCESSING: { label: "İşleniyor", color: "text-green-500", bgColor: "bg-green-500/10" },
  COMPLETED: { label: "Tamamlandı", color: "text-green-500", bgColor: "bg-green-500/10" },
  CANCELLED: { label: "İptal", color: "text-red-500", bgColor: "bg-red-500/10" },
  REFUNDED: { label: "İade", color: "text-orange-500", bgColor: "bg-orange-500/10" },
};

const billingPeriodLabels: Record<string, string> = {
  monthly: "Aylik",
  quarterly: "3 Aylik",
  semiannual: "6 Aylik",
  yearly: "Yillik",
  biennial: "2 Yillik",
  triennial: "3 Yillik",
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(price);
};

const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateTime = (date: Date | string | null | undefined) => {
  if (!date) return "-";
  return new Date(date).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) return notFound();

  const status = statusConfig[order.status] ?? statusConfig.PENDING;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/yonetim/siparisler"
        className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Siparislere Don
      </Link>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              Siparis {order.orderNumber}
            </h1>
            <span className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium",
              status.bgColor,
              status.color
            )}>
              {status.label}
            </span>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400">
            Olusturulma: {formatDateTime(order.createdAt)}
          </p>
        </div>
        {/* Interactive action buttons */}
        <OrderDetailActions orderId={order.id} status={order.status} />
      </div>

      {/* Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Info */}
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-900 dark:text-white text-base flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Ürün Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{order.product.name}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {order.product.category?.name ?? "Kategori yok"} - {order.product.sku}
                  </p>
                  {order.domain && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Domain: {order.domain}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {formatPrice(Number(order.basePrice))}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {billingPeriodLabels[order.billingPeriod] ?? order.billingPeriod}
                  </p>
                </div>
              </div>

              {/* Order Items */}
              {order.items.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Siparis Kalemleri</p>
                  <div className="space-y-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/50">
                        <div>
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">{item.productName}</span>
                          <span className="text-xs text-zinc-500 ml-2">x{item.quantity}</span>
                        </div>
                        <span className="text-sm font-medium text-zinc-900 dark:text-white">
                          {formatPrice(Number(item.totalPrice))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pricing Breakdown */}
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-900 dark:text-white text-base flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Fiyat Dokumu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">Paket Ucreti</span>
                  <span className="text-zinc-900 dark:text-white">{formatPrice(Number(order.basePrice))}</span>
                </div>
                {Number(order.setupFee) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">Kurulum Ucreti</span>
                    <span className="text-zinc-900 dark:text-white">{formatPrice(Number(order.setupFee))}</span>
                  </div>
                )}
                {Number(order.discountAmount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Indirim
                      {order.promoCode && (
                        <span className="ml-2 px-2 py-0.5 bg-green-500/10 text-green-500 rounded text-xs">
                          {order.promoCode.code}
                        </span>
                      )}
                    </span>
                    <span className="text-green-500">-{formatPrice(Number(order.discountAmount))}</span>
                  </div>
                )}
                <Separator className="bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">KDV (%{Number(order.taxRate)})</span>
                  <span className="text-zinc-900 dark:text-white">{formatPrice(Number(order.taxAmount))}</span>
                </div>
                <Separator className="bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex justify-between">
                  <span className="font-medium text-zinc-900 dark:text-white">Toplam</span>
                  <span className="text-xl font-bold text-zinc-900 dark:text-white">{formatPrice(Number(order.totalAmount))}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          {order.activities.length > 0 && (
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Sipariş Geçmişi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.activities.map((activity) => (
                    <div key={activity.id} className="flex gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 shrink-0">
                        <CheckCircle className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="flex-1 pb-4 border-b border-zinc-200 dark:border-zinc-800 last:border-0 last:pb-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-white">{activity.action}</p>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">{activity.description}</p>
                          </div>
                          <span className="text-xs text-zinc-500">{formatDateTime(activity.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Order Info */}
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-900 dark:text-white text-base">Siparis Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Durum</span>
                <span className={cn("text-sm font-medium", status.color)}>{status.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Fatura Dönemi</span>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {billingPeriodLabels[order.billingPeriod] ?? order.billingPeriod}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Olusturulma</span>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{formatDate(order.createdAt)}</span>
              </div>
              {order.approvedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Onaylanma</span>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{formatDate(order.approvedAt)}</span>
                </div>
              )}
              {order.completedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Tamamlanma</span>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{formatDate(order.completedAt)}</span>
                </div>
              )}
              {order.cancelledAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">İptal Tarihi</span>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{formatDate(order.cancelledAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer */}
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-900 dark:text-white text-base">Müşteri</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/yonetim/musteriler/${order.customer.id}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white text-sm font-medium">
                  {order.customer.name[0]}{order.customer.surname?.[0] ?? ""}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                    {order.customer.name} {order.customer.surname}
                  </p>
                  {order.customer.companyName && (
                    <p className="text-xs text-zinc-500 flex items-center gap-1 truncate">
                      <Building2 className="h-3 w-3 shrink-0" />
                      {order.customer.companyName}
                    </p>
                  )}
                </div>
                <ExternalLink className="h-4 w-4 text-zinc-400" />
              </Link>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <Mail className="h-4 w-4" />
                  <span>{order.customer.email}</span>
                </div>
                {order.customer.phone && (
                  <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                    <User className="h-4 w-4" />
                    <span>{order.customer.phone}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Related Invoice */}
          {order.invoice && (
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base">İlgili Fatura</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/yonetim/faturalar/${order.invoice.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{order.invoice.invoiceNumber}</p>
                      <p className="text-xs text-zinc-500">
                        {order.invoice.status === "PAID" ? "Ödendi" : "Bekliyor"}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-zinc-400" />
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Admin Notes */}
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-900 dark:text-white text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Admin Notlari
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.adminNotes ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{order.adminNotes}</p>
              ) : (
                <p className="text-sm text-zinc-500 italic">Henüz not eklenmemiş</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
