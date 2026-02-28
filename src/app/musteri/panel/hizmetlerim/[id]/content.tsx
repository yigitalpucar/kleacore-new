"use client";

import Link from "next/link";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package,
  Server,
  Shield,
  Cloud,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  ExternalLink,
  RefreshCcw,
  Settings,
  CreditCard,
  Calendar,
  Globe,
  HardDrive,
  Cpu,
  MemoryStick,
  Activity,
  Download,
  Upload,
  Power,
  Terminal,
  Copy,
  FileText,
  Mail,
  Database,
  FolderOpen,
  Users,
  Lock,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof CheckCircle2;
}> = {
  ACTIVE: {
    label: "Aktif",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    icon: CheckCircle2,
  },
  EXPIRED: {
    label: "Süresi Doldu",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    icon: XCircle,
  },
  SUSPENDED: {
    label: "Askıda",
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/30",
    icon: Clock,
  },
  CANCELLED: {
    label: "İptal",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    icon: AlertCircle,
  },
};

const categoryIcons: Record<string, typeof Package> = {
  hosting: Package,
  vds: Server,
  vps: Server,
  server: Server,
  ssl: Shield,
  domain: Cloud,
  email: Package,
};

const billingPeriodLabels: Record<string, string> = {
  monthly: "Aylık",
  quarterly: "3 Aylık",
  semiannual: "6 Aylık",
  yearly: "Yıllık",
  biennial: "2 Yıllık",
  triennial: "3 Yıllık",
};

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

interface ServiceData {
  id: string;
  label: string;
  domain: string | null;
  status: string;
  amount: number;
  billingPeriod: string;
  ipAddress: string | null;
  createdAt: string;
  nextDueDate: string | null;
  expiresAt: string | null;
  diskUsed: number | null;
  diskLimit: number | null;
  bandwidthUsed: number | null;
  bandwidthLimit: number | null;
  cpuUsage: number | null;
  ramUsage: number | null;
  product: {
    id: string;
    name: string;
    features: string[];
    resourceLimits: Record<string, string>;
    category: {
      slug: string;
      name: string;
    } | null;
  };
  backups: {
    id: string;
    type: string;
    status: string;
    size: number | null;
    completedAt: string | null;
    createdAt: string;
  }[];
}

interface HizmetDetayContentProps {
  service: ServiceData;
}

export function HizmetDetayContent({ service }: HizmetDetayContentProps) {
  const categorySlug = service.product.category?.slug ?? "hosting";
  const isHosting = categorySlug === "hosting";
  const isServer = ["vds", "vps", "server"].includes(categorySlug);
  const isSsl = categorySlug === "ssl";

  const status = statusConfig[service.status] || statusConfig.ACTIVE;
  const StatusIcon = status.icon;
  const TypeIcon = categoryIcons[categorySlug] || Package;

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col gap-4">
          <Link
            href="/musteri/panel/hizmetlerim"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Hizmetlere Dön
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={cn("p-4 rounded-xl", status.bgColor)}>
                <TypeIcon className={cn("h-8 w-8", status.color)} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight">{service.product.name}</h1>
                  <span className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                    status.bgColor, status.color
                  )}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1">{service.domain || service.label || "-"}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Bitiş: {service.nextDueDate
                      ? new Date(service.nextDueDate).toLocaleDateString("tr-TR")
                      : service.expiresAt
                      ? new Date(service.expiresAt).toLocaleDateString("tr-TR")
                      : "-"}
                  </span>
                  <span className="flex items-center gap-1">
                    <CreditCard className="h-4 w-4" />
                    {currencyFormatter.format(service.amount)} / {billingPeriodLabels[service.billingPeriod] || service.billingPeriod}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href={`/musteri/panel/hizmetlerim/${service.id}/yenile`}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Yenile
                </Link>
              </Button>
              <Button>
                <Settings className="mr-2 h-4 w-4" />
                Yönet
              </Button>
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Quick Actions */}
      <BlurFade delay={0.15} inView>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hızlı İşlemler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {isHosting && (
                <>
                  <Button variant="outline" className="justify-start h-auto py-3">
                    <ExternalLink className="mr-2 h-4 w-4 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">cPanel</p>
                      <p className="text-xs text-muted-foreground">Kontrol paneli</p>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-3" asChild>
                    <Link href="/musteri/panel/webmail">
                      <Mail className="mr-2 h-4 w-4 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">Webmail</p>
                        <p className="text-xs text-muted-foreground">E-posta yönetimi</p>
                      </div>
                    </Link>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-3">
                    <Database className="mr-2 h-4 w-4 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">phpMyAdmin</p>
                      <p className="text-xs text-muted-foreground">Veritabanı yönetimi</p>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-3">
                    <FolderOpen className="mr-2 h-4 w-4 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">Dosya Yöneticisi</p>
                      <p className="text-xs text-muted-foreground">Dosya işlemleri</p>
                    </div>
                  </Button>
                </>
              )}
              {isServer && (
                <>
                  <Button variant="outline" className="justify-start h-auto py-3">
                    <Terminal className="mr-2 h-4 w-4 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">SSH Konsol</p>
                      <p className="text-xs text-muted-foreground">Terminal erişimi</p>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-3">
                    <Power className="mr-2 h-4 w-4 text-orange-500" />
                    <div className="text-left">
                      <p className="font-medium">Yeniden Başlat</p>
                      <p className="text-xs text-muted-foreground">Sunucuyu restart et</p>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-3">
                    <Download className="mr-2 h-4 w-4 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">Snapshot Al</p>
                      <p className="text-xs text-muted-foreground">Anlık görüntü</p>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-3">
                    <Settings className="mr-2 h-4 w-4 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">OS Değiştir</p>
                      <p className="text-xs text-muted-foreground">İşletim sistemi</p>
                    </div>
                  </Button>
                </>
              )}
              {isSsl && (
                <>
                  <Button variant="outline" className="justify-start h-auto py-3">
                    <Download className="mr-2 h-4 w-4 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">Sertifika İndir</p>
                      <p className="text-xs text-muted-foreground">CRT dosyası</p>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-3">
                    <Lock className="mr-2 h-4 w-4 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">Private Key</p>
                      <p className="text-xs text-muted-foreground">Özel anahtar</p>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-3">
                    <RefreshCcw className="mr-2 h-4 w-4 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">Yeniden Oluştur</p>
                      <p className="text-xs text-muted-foreground">CSR & Key</p>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-3">
                    <FileText className="mr-2 h-4 w-4 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">CA Bundle</p>
                      <p className="text-xs text-muted-foreground">Ara sertifika</p>
                    </div>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Resource Usage - For Hosting & Server */}
          {(isHosting || isServer) && (
            <BlurFade delay={0.2} inView>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Kaynak Kullanımı
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {service.diskUsed != null && service.diskLimit != null && service.diskLimit > 0 && (
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-muted-foreground" />
                          Disk Kullanımı
                        </span>
                        <span className="font-medium">
                          {service.diskUsed} GB / {service.diskLimit} GB
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            (service.diskUsed / service.diskLimit) * 100 > 80
                              ? "bg-red-500"
                              : (service.diskUsed / service.diskLimit) * 100 > 60
                              ? "bg-orange-500"
                              : "bg-primary"
                          )}
                          style={{ width: `${Math.min((service.diskUsed / service.diskLimit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {service.bandwidthUsed != null && service.bandwidthLimit != null && service.bandwidthLimit > 0 && (
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="flex items-center gap-2">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          Bant Genişliği
                        </span>
                        <span className="font-medium">
                          {service.bandwidthUsed} {isServer ? "TB" : "GB"} / {service.bandwidthLimit} {isServer ? "TB" : "GB"}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${Math.min((service.bandwidthUsed / service.bandwidthLimit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {isServer && service.cpuUsage != null && (
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-muted-foreground" />
                          CPU Kullanımı
                        </span>
                        <span className="font-medium">{service.cpuUsage}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            service.cpuUsage > 80 ? "bg-red-500" : service.cpuUsage > 60 ? "bg-orange-500" : "bg-green-500"
                          )}
                          style={{ width: `${service.cpuUsage}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {isServer && service.ramUsage != null && (
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="flex items-center gap-2">
                          <MemoryStick className="h-4 w-4 text-muted-foreground" />
                          RAM Kullanımı
                        </span>
                        <span className="font-medium">{service.ramUsage}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            service.ramUsage > 80 ? "bg-red-500" : service.ramUsage > 60 ? "bg-orange-500" : "bg-purple-500"
                          )}
                          style={{ width: `${service.ramUsage}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </BlurFade>
          )}

          {/* Server Specs from resourceLimits */}
          {isServer && Object.keys(service.product.resourceLimits).length > 0 && (
            <BlurFade delay={0.25} inView>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    Sunucu Özellikleri
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {service.product.resourceLimits.cpu && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Cpu className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-xs text-muted-foreground">İşlemci</p>
                          <p className="font-medium">{service.product.resourceLimits.cpu}</p>
                        </div>
                      </div>
                    )}
                    {service.product.resourceLimits.ram && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <MemoryStick className="h-5 w-5 text-purple-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">RAM</p>
                          <p className="font-medium">{service.product.resourceLimits.ram}</p>
                        </div>
                      </div>
                    )}
                    {service.product.resourceLimits.storage && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <HardDrive className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Depolama</p>
                          <p className="font-medium">{service.product.resourceLimits.storage}</p>
                        </div>
                      </div>
                    )}
                    {service.product.resourceLimits.bandwidth && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Activity className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Bant Genişliği</p>
                          <p className="font-medium">{service.product.resourceLimits.bandwidth}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </BlurFade>
          )}

          {/* SSL Details */}
          {isSsl && (
            <BlurFade delay={0.2} inView>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Sertifika Detayları
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="p-4 rounded-lg border">
                      <p className="text-sm text-muted-foreground">Sertifika Tipi</p>
                      <p className="font-semibold mt-1">{service.product.name}</p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <p className="text-sm text-muted-foreground">Kapsam</p>
                      <p className="font-semibold mt-1">{service.domain || "-"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </BlurFade>
          )}

          {/* Features */}
          {Array.isArray(service.product.features) && service.product.features.length > 0 && (
            <BlurFade delay={0.3} inView>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Özellikler
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {service.product.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        {String(feature)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </BlurFade>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Service Info */}
          <BlurFade delay={0.35} inView>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hizmet Bilgileri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kategori</span>
                    <span className="font-medium">{service.product.category?.name || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Başlangıç</span>
                    <span className="font-medium">
                      {new Date(service.createdAt).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bitiş</span>
                    <span className="font-medium">
                      {service.nextDueDate
                        ? new Date(service.nextDueDate).toLocaleDateString("tr-TR")
                        : service.expiresAt
                        ? new Date(service.expiresAt).toLocaleDateString("tr-TR")
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fiyat</span>
                    <span className="font-medium">
                      {currencyFormatter.format(service.amount)} / {billingPeriodLabels[service.billingPeriod] || service.billingPeriod}
                    </span>
                  </div>
                  {service.ipAddress && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">IP Adresi</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{service.ipAddress}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => navigator.clipboard.writeText(service.ipAddress!)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t space-y-2">
                  <Button className="w-full" variant="outline" asChild>
                    <Link href={`/musteri/panel/hizmetlerim/${service.id}/yenile`}>
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Hizmeti Yenile
                    </Link>
                  </Button>
                  <Button className="w-full" variant="outline" asChild>
                    <Link href={`/musteri/panel/hizmetlerim/${service.id}/fatura`}>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Faturayı Görüntüle
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </BlurFade>

          {/* Support */}
          <BlurFade delay={0.4} inView>
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium mb-1">Yardıma mı ihtiyacınız var?</p>
                    <p className="text-muted-foreground mb-3">
                      7/24 teknik destek ekibimiz size yardımcı olmaya hazır.
                    </p>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/musteri/panel/destek">
                        Destek Talebi Aç
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
