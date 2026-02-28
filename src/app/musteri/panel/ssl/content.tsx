"use client";

import { useState } from "react";
import Link from "next/link";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Shield,
  Search,
  MoreVertical,
  RefreshCcw,
  Download,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Lock,
  Key,
  FileText,
  Plus,
  Clock,
  Eye,
  Copy,
  Calendar,
  Building,
  ShieldCheck,
  ShieldAlert,
  Settings,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toggleAutoRenew } from "@/lib/actions/customer/ssl";
import { toast } from "@/lib/toast";

const statusConfig: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof CheckCircle2;
}> = {
  ACTIVE: {
    label: "Aktif",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    icon: CheckCircle2,
  },
  EXPIRED: {
    label: "Süresi Doldu",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    icon: XCircle,
  },
  PENDING: {
    label: "Beklemede",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    icon: Clock,
  },
  REVOKED: {
    label: "İptal Edildi",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    icon: AlertCircle,
  },
};

const typeConfig: Record<string, { color: string; label: string }> = {
  DV: { color: "bg-blue-500", label: "Domain Validated" },
  OV: { color: "bg-purple-500", label: "Organization Validated" },
  EV: { color: "bg-green-500", label: "Extended Validation" },
  WILDCARD: { color: "bg-orange-500", label: "Wildcard SSL" },
};

const filterOptions = [
  { value: "all", label: "Tümü" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "EXPIRED", label: "Süresi Doldu" },
  { value: "PENDING", label: "Beklemede" },
  { value: "REVOKED", label: "İptal Edildi" },
];

interface CertificateItem {
  id: string;
  domain: string;
  type: string;
  provider: string;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  daysLeft: number;
}

interface SSLContentProps {
  certificates: CertificateItem[];
  stats: {
    total: number;
    active: number;
    expiring: number;
    expired: number;
  };
}

export function SSLContent({ certificates, stats }: SSLContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [localCerts, setLocalCerts] = useState(certificates);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggleAutoRenew = async (certId: string) => {
    setTogglingId(certId);
    const result = await toggleAutoRenew(certId);
    if (result.success) {
      setLocalCerts((prev) =>
        prev.map((c) => (c.id === certId ? { ...c, autoRenew: result.autoRenew! } : c))
      );
      toast.success("Otomatik yenileme güncellendi");
    } else {
      toast.error(result.error || "İşlem başarısız");
    }
    setTogglingId(null);
  };

  const filteredCertificates = localCerts.filter((cert) => {
    const matchesSearch = cert.domain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" || cert.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SSL Sertifikaları</h1>
            <p className="text-muted-foreground">
              SSL sertifikalarınızı görüntüleyin ve yönetin.
            </p>
          </div>
          <Button asChild>
            <Link href="/ssl">
              <Plus className="mr-2 h-4 w-4" />
              Yeni SSL Al
            </Link>
          </Button>
        </div>
      </BlurFade>

      {/* Stats */}
      <BlurFade delay={0.15} inView>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam SSL</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aktif</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sona Eriyor</p>
                  <p className="text-2xl font-bold">{stats.expiring}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Süresi Doldu</p>
                  <p className="text-2xl font-bold">{stats.expired}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </BlurFade>

      {/* Search & Filter */}
      <BlurFade delay={0.2} inView>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex gap-2">
                {filterOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={filter === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Domain ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Certificates List */}
      <BlurFade delay={0.25} inView>
        <Card>
          <CardHeader>
            <CardTitle>Sertifikalar ({filteredCertificates.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredCertificates.map((cert) => {
                const status = statusConfig[cert.status] || statusConfig.ACTIVE;
                const typeInfo = typeConfig[cert.type];
                const StatusIcon = status.icon;
                const isExpiring = cert.status === "ACTIVE" && cert.daysLeft > 0 && cert.daysLeft <= 30;

                return (
                  <div
                    key={cert.id}
                    className="p-4 rounded-lg border hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn("p-3 rounded-lg", status.bgColor)}>
                        <Shield className={cn("h-6 w-6", status.color)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{cert.domain}</p>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full text-white",
                            typeInfo?.color || "bg-gray-500"
                          )}>
                            {cert.type}
                          </span>
                          <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", status.bgColor, status.color)}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </div>
                        </div>

                        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building className="h-4 w-4" />
                            <span>Sağlayıcı: {cert.provider}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>Bitiş: {cert.expiresAt
                              ? new Date(cert.expiresAt).toLocaleDateString("tr-TR")
                              : "-"}</span>
                          </div>
                          {cert.daysLeft > 0 && cert.status === "ACTIVE" && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <span>{cert.daysLeft} gün kaldı</span>
                            </div>
                          )}
                        </div>

                        {isExpiring && (
                          <div className="mt-3 p-2 rounded bg-orange-500/10 text-orange-500 text-sm">
                            <AlertCircle className="inline h-4 w-4 mr-1" />
                            Sertifikanızın süresi {cert.daysLeft} gün içinde dolacak. Yenilemeyi unutmayın!
                          </div>
                        )}

                        {cert.status === "PENDING" && (
                          <div className="mt-3 p-2 rounded bg-blue-500/10 text-blue-500 text-sm">
                            <Clock className="inline h-4 w-4 mr-1" />
                            Sertifikanız doğrulama aşamasında. DNS kayıtlarını kontrol edin.
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Otomatik Yenileme</span>
                          <Switch
                            checked={cert.autoRenew}
                            disabled={cert.status === "EXPIRED" || cert.status === "PENDING" || togglingId === cert.id}
                            onCheckedChange={() => handleToggleAutoRenew(cert.id)}
                          />
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          {cert.status !== "PENDING" && cert.status !== "EXPIRED" && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/musteri/panel/ssl/${cert.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                Detay
                              </Link>
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {cert.status !== "PENDING" && (
                                <>
                                  <DropdownMenuItem>
                                    <Download className="mr-2 h-4 w-4" />
                                    Sertifikayı İndir
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Key className="mr-2 h-4 w-4" />
                                    Private Key İndir
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <FileText className="mr-2 h-4 w-4" />
                                    CSR Görüntüle
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {cert.status === "PENDING" && (
                                <DropdownMenuItem>
                                  <RefreshCcw className="mr-2 h-4 w-4" />
                                  Doğrulamayı Kontrol Et
                                </DropdownMenuItem>
                              )}
                              {cert.status === "EXPIRED" && (
                                <DropdownMenuItem>
                                  <RefreshCcw className="mr-2 h-4 w-4" />
                                  Yenile
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem>
                                <Settings className="mr-2 h-4 w-4" />
                                Ayarlar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredCertificates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Aramanızla eşleşen sertifika bulunamadı.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* SSL Types Info */}
      <BlurFade delay={0.3} inView>
        <Card>
          <CardHeader>
            <CardTitle>SSL Sertifika Türleri</CardTitle>
            <CardDescription>
              İhtiyacınıza uygun SSL sertifikası seçin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-3 w-3 rounded-full bg-blue-500" />
                  <p className="font-medium">Domain Validated (DV)</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Temel şifreleme. Hızlı doğrulama. Kişisel siteler için ideal.
                </p>
              </div>
              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-3 w-3 rounded-full bg-purple-500" />
                  <p className="font-medium">Organization Validated (OV)</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Şirket doğrulaması. İş siteleri için önerilir.
                </p>
              </div>
              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-3 w-3 rounded-full bg-green-500" />
                  <p className="font-medium">Extended Validation (EV)</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  En yüksek güven. E-ticaret ve bankacılık için ideal.
                </p>
              </div>
              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-3 w-3 rounded-full bg-orange-500" />
                  <p className="font-medium">Wildcard SSL</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tüm alt domainleri kapsar. Çoklu site sahipleri için.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
