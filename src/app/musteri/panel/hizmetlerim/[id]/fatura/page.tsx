import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getServiceById } from "@/lib/dal/services";
import { getInvoicesByCustomer } from "@/lib/dal/invoices";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  FileText,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  Calendar,
  ExternalLink,
  Receipt,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

const statusConfig: Record<string, {
  label: string;
  icon: typeof CheckCircle2;
  color: string;
  bg: string;
}> = {
  PAID: {
    label: "Ödendi",
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-500/10",
  },
  PENDING: {
    label: "Bekliyor",
    icon: Clock,
    color: "text-yellow-600",
    bg: "bg-yellow-500/10",
  },
  OVERDUE: {
    label: "Gecikmiş",
    icon: AlertCircle,
    color: "text-red-600",
    bg: "bg-red-500/10",
  },
  DRAFT: {
    label: "Taslak",
    icon: FileText,
    color: "text-gray-600",
    bg: "bg-gray-500/10",
  },
  CANCELLED: {
    label: "İptal",
    icon: AlertCircle,
    color: "text-orange-600",
    bg: "bg-orange-500/10",
  },
};

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

export default async function ServiceInvoicesPage(props: Props) {
  const params = await props.params;
  const session = await auth();
  const userId = session!.user.id;

  const service = await getServiceById(params.id);

  if (!service || service.customerId !== userId) {
    notFound();
  }

  // Get all customer invoices — DB does not have a direct service-invoice relation,
  // so we fetch all and show them in context of this service
  const invoices = await getInvoicesByCustomer(userId);

  const totalPaid = invoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + Number(inv.paidAmount), 0);

  const pendingAmount = invoices
    .filter((inv) => inv.status === "PENDING" || inv.status === "OVERDUE")
    .reduce((sum, inv) => sum + Number(inv.totalAmount) - Number(inv.paidAmount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0.1} inView>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/musteri/panel/hizmetlerim/${params.id}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hizmet Faturaları</h1>
            <p className="text-muted-foreground">
              {service.product.name} - {service.domain || service.label || "-"}
            </p>
          </div>
        </div>
      </BlurFade>

      {/* Stats */}
      <BlurFade delay={0.15} inView>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Receipt className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Fatura</p>
                  <p className="text-2xl font-bold">{invoices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Odenen</p>
                  <p className="text-2xl font-bold">{currencyFormatter.format(totalPaid)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  pendingAmount > 0 ? "bg-yellow-500/10" : "bg-gray-500/10"
                )}>
                  <Clock className={cn(
                    "h-5 w-5",
                    pendingAmount > 0 ? "text-yellow-500" : "text-gray-500"
                  )} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bekleyen</p>
                  <p className="text-2xl font-bold">{currencyFormatter.format(pendingAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </BlurFade>

      {/* Invoices List */}
      <BlurFade delay={0.2} inView>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Fatura Geçmişi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {invoices.map((invoice) => {
                const status = statusConfig[invoice.status] || statusConfig.PENDING;
                const StatusIcon = status.icon;

                return (
                  <div
                    key={invoice.id}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:shadow-sm transition-shadow"
                  >
                    <div className={cn("p-3 rounded-lg", status.bg)}>
                      <FileText className={cn("h-6 w-6", status.color)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{invoice.invoiceNumber}</p>
                        <span className={cn(
                          "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                          status.bg,
                          status.color
                        )}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(invoice.issuedAt).toLocaleDateString("tr-TR")}
                        </span>
                        {invoice.status === "PAID" && invoice.paidAt && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            Ödeme: {new Date(invoice.paidAt).toLocaleDateString("tr-TR")}
                          </span>
                        )}
                        {(invoice.status === "PENDING" || invoice.status === "OVERDUE") && (
                          <span className={cn(
                            "flex items-center gap-1",
                            invoice.status === "OVERDUE" ? "text-red-600" : "text-yellow-600"
                          )}>
                            <Clock className="h-3 w-3" />
                            Son Ödeme: {new Date(invoice.dueDate).toLocaleDateString("tr-TR")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {currencyFormatter.format(Number(invoice.totalAmount))}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {(invoice.status === "PENDING" || invoice.status === "OVERDUE") && (
                        <Button size="sm" asChild>
                          <Link href={`/musteri/panel/faturalar/${invoice.id}`}>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Ode
                          </Link>
                        </Button>
                      )}
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/musteri/panel/faturalar/${invoice.id}`}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Detay
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {invoices.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Bu hizmete ait fatura bulunamadı.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Quick Actions */}
      <BlurFade delay={0.25} inView>
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div className="text-sm">
                  <p className="font-medium">Tüm faturalarınızı görmek ister misiniz?</p>
                  <p className="text-muted-foreground">
                    Faturalar sayfasından tüm hizmetlerinize ait faturaları görüntüleyebilirsiniz.
                  </p>
                </div>
              </div>
              <Button variant="outline" asChild>
                <Link href="/musteri/panel/faturalar">
                  Tüm Faturalar
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
