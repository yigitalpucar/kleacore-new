"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Server,
  HardDrive,
  Cloud,
  Globe,
  Shield,
  Mail,
  User,
  Building2,
  CreditCard,
  RefreshCcw,
  FileText,
  Edit,
  Pause,
  XCircle,
  CheckCircle,
  ArrowUpDown,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import {
  activateService,
  cancelService,
  suspendService,
} from "@/lib/actions/admin/services";
import { toast } from "@/lib/toast";

interface ServiceDetailData {
  id: string;
  label: string;
  domain: string | null;
  username: string | null;
  ipAddress: string | null;
  serverName: string | null;
  status: string;
  billingPeriod: string;
  amount: number;
  nextDueDate: Date | null;
  expiresAt: Date | null;
  suspendedAt: Date | null;
  cancelledAt: Date | null;
  suspendReason: string | null;
  diskUsed: number | null;
  diskLimit: number | null;
  bandwidthUsed: number | null;
  bandwidthLimit: number | null;
  createdAt: Date;
  customer: {
    id: string;
    name: string;
    surname: string;
    email: string;
    phone: string | null;
    companyName: string | null;
  };
  product: {
    id: string;
    name: string;
    sku: string;
    category: {
      id: string;
      slug: string;
      name: string;
    };
  };
  backups: Array<{
    id: string;
    type: string;
    status: string;
    size: number | null;
    createdAt: Date;
  }>;
}

interface ServiceDetailContentProps {
  service: ServiceDetailData;
}

const categoryConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  hosting: { label: "Web Hosting", icon: Server, color: "text-blue-500 bg-blue-500/10" },
  vds: { label: "VDS Sunucu", icon: HardDrive, color: "text-purple-500 bg-purple-500/10" },
  vps: { label: "VPS Sunucu", icon: Cloud, color: "text-cyan-500 bg-cyan-500/10" },
  server: { label: "Fiziksel Sunucu", icon: Server, color: "text-orange-500 bg-orange-500/10" },
  domain: { label: "Domain", icon: Globe, color: "text-green-500 bg-green-500/10" },
  ssl: { label: "SSL Sertifikası", icon: Shield, color: "text-yellow-500 bg-yellow-500/10" },
  email: { label: "Kurumsal E-posta", icon: Mail, color: "text-pink-500 bg-pink-500/10" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Aktif", color: "bg-green-500/10 text-green-500 border-green-500/30" },
  SUSPENDED: { label: "Askıda", color: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
  CANCELLED: { label: "İptal", color: "bg-red-500/10 text-red-500 border-red-500/30" },
  EXPIRED: { label: "Süresi Dolmuş", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" },
};

const billingPeriodLabels: Record<string, string> = {
  monthly: "Aylık",
  quarterly: "3 Aylık",
  semiannual: "6 Aylık",
  yearly: "Yıllık",
  biennial: "2 Yıllık",
  triennial: "3 Yıllık",
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(price);
};

export function ServiceDetailContent({ service }: ServiceDetailContentProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const router = useRouter();

  const slug = service.product.category?.slug || "hosting";
  const CategoryIcon = categoryConfig[slug]?.icon || Server;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSuspendService = async () => {
    const reason =
      prompt("Askıya alma nedeni:", "Yonetim tarafindan askiya alindi")?.trim() ??
      "";
    if (!reason) return;

    const result = await suspendService(service.id, reason);
    if (!result.success) {
      toast.error(result.error ?? "Hizmet askıya alınamadı");
      return;
    }

    toast.success("Hizmet askıya alındı");
    router.refresh();
  };

  const handleActivateService = async () => {
    const result = await activateService(service.id);
    if (!result.success) {
      toast.error(result.error ?? "Hizmet aktifleştirilemedi");
      return;
    }

    toast.success("Hizmet aktifleştirildi");
    router.refresh();
  };

  const handleCancelService = async () => {
    const confirmed = window.confirm(
      "Bu hizmeti iptal etmek istediğinize emin misiniz?"
    );
    if (!confirmed) return;

    const result = await cancelService(service.id);
    if (!result.success) {
      toast.error(result.error ?? "Hizmet iptal edilemedi");
      return;
    }

    toast.success("Hizmet iptal edildi");
    router.refresh();
  };

  const yearlyPrice = Number(service.amount) * 12;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <BlurFade delay={0}>
        <Link
          href="/yonetim/hizmetler"
          className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Hizmetlere Dön
        </Link>
      </BlurFade>

      {/* Page Header */}
      <BlurFade delay={0.05}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn("p-3 rounded-lg", categoryConfig[slug]?.color.split(" ")[1])}>
              <CategoryIcon className={cn("h-8 w-8", categoryConfig[slug]?.color.split(" ")[0])} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{service.domain || service.label || service.product.name}</h1>
                <Badge className={cn("border", statusConfig[service.status]?.color)}>
                  {statusConfig[service.status]?.label || service.status}
                </Badge>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400">
                {categoryConfig[slug]?.label} - {service.product.name}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Edit className="mr-2 h-4 w-4" />
              Düzenle
            </Button>
            <Button variant="outline" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              Yükselt/Düşür
            </Button>
            <Button variant="outline" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <FileText className="mr-2 h-4 w-4" />
              Fatura Oluştur
            </Button>
            {service.status === "ACTIVE" && (
              <Button
                variant="outline"
                onClick={() => {
                  void handleSuspendService();
                }}
                className="border-orange-500/30 text-orange-500 hover:bg-orange-500/10"
              >
                <Pause className="mr-2 h-4 w-4" />
                Askıya Al
              </Button>
            )}
            {service.status === "SUSPENDED" && (
              <Button
                variant="outline"
                onClick={() => {
                  void handleActivateService();
                }}
                className="border-green-500/30 text-green-500 hover:bg-green-500/10"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Aktif Et
              </Button>
            )}
          </div>
        </div>
      </BlurFade>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Service Info Card */}
          <BlurFade delay={0.1}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white">Hizmet Bilgileri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm text-zinc-500">Hizmet ID</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium font-mono text-zinc-900 dark:text-white">{service.id.slice(0, 12)}</p>
                      <button
                        onClick={() => copyToClipboard(service.id, "id")}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        {copiedField === "id" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-zinc-500">Domain</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{service.domain || "-"}</p>
                      {service.domain && (
                        <a
                          href={`https://${service.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-zinc-500">Kategori</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{categoryConfig[slug]?.label || service.product.category.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-zinc-500">Paket</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{service.product.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-zinc-500">Oluşturma Tarihi</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                      {new Date(service.createdAt).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-zinc-500">Sonraki Yenileme</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                      {service.nextDueDate ? new Date(service.nextDueDate).toLocaleDateString("tr-TR") : "-"}
                    </p>
                  </div>
                </div>

                {(service.serverName || service.ipAddress) && (
                  <>
                    <Separator className="bg-zinc-200 dark:bg-zinc-800" />
                    <div className="space-y-1">
                      <p className="text-sm text-zinc-500">Sunucu Bilgileri</p>
                      <div className="flex items-center gap-4">
                        {service.serverName && (
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">{service.serverName}</p>
                        )}
                        {service.ipAddress && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">{service.ipAddress}</span>
                            <button
                              onClick={() => copyToClipboard(service.ipAddress!, "ip")}
                              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                            >
                              {copiedField === "ip" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {service.suspendReason && (
                  <>
                    <Separator className="bg-zinc-200 dark:bg-zinc-800" />
                    <div className="space-y-1">
                      <p className="text-sm text-zinc-500">Askıya Alma Nedeni</p>
                      <p className="text-sm text-zinc-900 dark:text-white">{service.suspendReason}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </BlurFade>

          {/* Tabs for Backups and Activity */}
          <BlurFade delay={0.15}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardContent className="p-0">
                <Tabs defaultValue="backups" className="w-full">
                  <TabsList className="w-full justify-start rounded-none border-b border-zinc-200 dark:border-zinc-800 bg-transparent p-0">
                    <TabsTrigger
                      value="backups"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
                    >
                      Yedekler ({service.backups.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="backups" className="p-0 mt-0">
                    {service.backups.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-sm text-zinc-500">Henüz yedek bulunmuyor</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-800">
                              <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Tip</th>
                              <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Boyut</th>
                              <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                              <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Tarih</th>
                            </tr>
                          </thead>
                          <tbody>
                            {service.backups.map((backup) => (
                              <tr key={backup.id} className="border-b border-zinc-200 dark:border-zinc-800 last:border-0">
                                <td className="p-4">
                                  <span className="text-sm text-zinc-900 dark:text-white">{backup.type}</span>
                                </td>
                                <td className="p-4">
                                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                    {backup.size ? `${(backup.size / 1024).toFixed(2)} GB` : "-"}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{backup.status}</span>
                                </td>
                                <td className="p-4">
                                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                    {new Date(backup.createdAt).toLocaleDateString("tr-TR")}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </BlurFade>
        </div>

        {/* Right Column - Customer & Billing */}
        <div className="space-y-6">
          {/* Customer Card */}
          <BlurFade delay={0.2}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Müşteri Bilgileri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                    {service.customer.name[0]}{service.customer.surname[0]}
                  </div>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">{service.customer.name} {service.customer.surname}</p>
                    {service.customer.companyName && (
                      <p className="text-xs text-zinc-500 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {service.customer.companyName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{service.customer.email}</p>
                  {service.customer.phone && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{service.customer.phone}</p>
                  )}
                </div>
                <Link href={`/yonetim/musteriler/${service.customer.id}`}>
                  <Button variant="outline" size="sm" className="w-full mt-2 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    Müşteri Profiline Git
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </BlurFade>

          {/* Billing Card */}
          <BlurFade delay={0.25}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Faturalama
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Dönem</span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">
                    {billingPeriodLabels[service.billingPeriod] || service.billingPeriod}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Aylık Tutar</span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">
                    {formatPrice(Number(service.amount))}
                  </span>
                </div>
                <Separator className="bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Yıllık Tutar</span>
                  <span className="text-lg font-bold text-primary">
                    {formatPrice(yearlyPrice)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Sonraki Ödeme</span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">
                    {service.nextDueDate ? new Date(service.nextDueDate).toLocaleDateString("tr-TR") : "-"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </BlurFade>

          {/* Quick Actions */}
          <BlurFade delay={0.3}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base">Hızlı İşlemler</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Manuel Yenileme
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Paket Değiştir
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <FileText className="mr-2 h-4 w-4" />
                  Yenileme Faturası
                </Button>
                <Separator className="bg-zinc-200 dark:bg-zinc-800 my-2" />
                {service.status !== "CANCELLED" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void handleCancelService();
                    }}
                    className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Hizmeti İptal Et
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="w-full justify-start border-zinc-300 dark:border-zinc-700 text-zinc-500"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Hizmet İptal Edildi
                  </Button>
                )}
              </CardContent>
            </Card>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
