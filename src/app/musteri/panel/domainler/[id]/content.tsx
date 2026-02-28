"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Globe,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCcw,
  Settings,
  Shield,
  Lock,
  Calendar,
  Server,
  Plus,
  Trash2,
  Edit,
  Copy,
  ExternalLink,
  ArrowRightLeft,
  Clock,
  FileText,
  Mail,
  MapPin,
  User,
  Phone,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { updateDnsRecords } from "@/lib/actions/customer/domains";
import { toast } from "@/lib/toast";
import type { DnsRecordType } from "@prisma/client";

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
  TRANSFERRING: {
    label: "Transfer Ediliyor",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    icon: ArrowRightLeft,
  },
  PENDING: {
    label: "Beklemede",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    icon: Clock,
  },
};

const dnsTypeColors: Record<string, string> = {
  A: "bg-blue-500",
  AAAA: "bg-purple-500",
  CNAME: "bg-green-500",
  MX: "bg-orange-500",
  TXT: "bg-gray-500",
  NS: "bg-pink-500",
  SRV: "bg-yellow-500",
};

const allowedDnsTypes: DnsRecordType[] = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "NS",
  "SRV",
];

function isDnsRecordType(value: string): value is DnsRecordType {
  return allowedDnsTypes.includes(value as DnsRecordType);
}

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  value: string;
  ttl: number;
  priority: number | null;
}

interface DomainDetail {
  id: string;
  name: string;
  registrar: string;
  status: string;
  autoRenew: boolean;
  privacyEnabled: boolean;
  registeredAt: string;
  expiresAt: string;
  nameservers: string[];
  whoisName: string | null;
  whoisEmail: string | null;
  whoisPhone: string | null;
  whoisAddress: string | null;
  dnsRecords: DnsRecord[];
}

interface DomainDetayContentProps {
  domain: DomainDetail;
}

export function DomainDetayContent({ domain }: DomainDetayContentProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>(domain.dnsRecords);
  const [isSavingDns, setIsSavingDns] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddDnsRecord = () => {
    const typeInput = prompt(
      "Kayıt tipi (A, AAAA, CNAME, MX, TXT, NS, SRV):",
      "A"
    );
    if (!typeInput) return;

    const typeValue = typeInput.trim().toUpperCase();
    if (!isDnsRecordType(typeValue)) {
      toast.error("Geçersiz DNS kayıt tipi");
      return;
    }

    const name = prompt("Kayıt adı (örn: @, www, mail):", "@")?.trim();
    if (!name) {
      toast.error("Kayıt adı zorunludur");
      return;
    }

    const value = prompt("Kayıt değeri:", "")?.trim();
    if (!value) {
      toast.error("Kayıt değeri zorunludur");
      return;
    }

    const ttlInput = prompt("TTL (saniye):", "3600")?.trim() ?? "3600";
    const parsedTtl = Number.parseInt(ttlInput, 10);
    const ttl = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 3600;

    const priorityInput =
      typeValue === "MX" || typeValue === "SRV"
        ? prompt("Öncelik (opsiyonel):", "10")?.trim() ?? ""
        : "";
    const parsedPriority = Number.parseInt(priorityInput, 10);
    const priority =
      priorityInput && Number.isFinite(parsedPriority) ? parsedPriority : null;

    setDnsRecords((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        type: typeValue,
        name,
        value,
        ttl,
        priority,
      },
    ]);
    toast.success("DNS kaydı eklendi. Kaydetmeyi unutmayın.");
  };

  const handleEditDnsRecord = (recordId: string) => {
    const current = dnsRecords.find((item) => item.id === recordId);
    if (!current) return;

    const typeInput = prompt(
      "Kayıt tipi (A, AAAA, CNAME, MX, TXT, NS, SRV):",
      current.type
    );
    if (!typeInput) return;

    const typeValue = typeInput.trim().toUpperCase();
    if (!isDnsRecordType(typeValue)) {
      toast.error("Geçersiz DNS kayıt tipi");
      return;
    }

    const name = prompt("Kayıt adı:", current.name)?.trim();
    if (!name) {
      toast.error("Kayıt adı zorunludur");
      return;
    }

    const value = prompt("Kayıt değeri:", current.value)?.trim();
    if (!value) {
      toast.error("Kayıt değeri zorunludur");
      return;
    }

    const ttlInput = prompt("TTL (saniye):", String(current.ttl))?.trim();
    const parsedTtl = Number.parseInt(ttlInput ?? "", 10);
    const ttl = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 3600;

    const priorityInput =
      typeValue === "MX" || typeValue === "SRV"
        ? prompt(
            "Öncelik (opsiyonel):",
            current.priority === null ? "" : String(current.priority)
          )?.trim() ?? ""
        : "";
    const parsedPriority = Number.parseInt(priorityInput, 10);
    const priority =
      priorityInput && Number.isFinite(parsedPriority) ? parsedPriority : null;

    setDnsRecords((prev) =>
      prev.map((record) =>
        record.id === recordId
          ? { ...record, type: typeValue, name, value, ttl, priority }
          : record
      )
    );
    toast.success("DNS kaydı güncellendi. Kaydetmeyi unutmayın.");
  };

  const handleDeleteDnsRecord = (recordId: string) => {
    const confirmed = window.confirm("Bu DNS kaydını silmek istediğinize emin misiniz?");
    if (!confirmed) return;

    setDnsRecords((prev) => prev.filter((record) => record.id !== recordId));
    toast.info("DNS kaydı kaldırıldı. Değişiklikleri kaydetmeyi unutmayın.");
  };

  const handleSaveDnsRecords = async () => {
    if (isSavingDns) return;

    const hasInvalid = dnsRecords.some(
      (record) =>
        !isDnsRecordType(record.type.toUpperCase()) ||
        !record.name.trim() ||
        !record.value.trim()
    );
    if (hasInvalid) {
      toast.error("Geçersiz DNS kayıtları var. Lütfen kontrol edin.");
      return;
    }

    setIsSavingDns(true);
    const payload = dnsRecords.map((record) => ({
      type: record.type.toUpperCase() as DnsRecordType,
      name: record.name.trim(),
      value: record.value.trim(),
      ttl: Number.isFinite(record.ttl) && record.ttl > 0 ? record.ttl : 3600,
      priority:
        record.priority !== null && Number.isFinite(record.priority)
          ? record.priority
          : undefined,
    }));

    const result = await updateDnsRecords(domain.id, payload);
    if (!result.success) {
      toast.error(result.error ?? "DNS kayıtları kaydedilemedi");
      setIsSavingDns(false);
      return;
    }

    toast.success("DNS kayıtları kaydedildi");
    router.refresh();
    setIsSavingDns(false);
  };

  const status = statusConfig[domain.status] || statusConfig.ACTIVE;
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col gap-4">
          <Link
            href="/musteri/panel/domainler"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Domainlere Dön
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={cn("p-4 rounded-xl", status.bgColor)}>
                <Globe className={cn("h-8 w-8", status.color)} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight">{domain.name}</h1>
                  <span className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                    status.bgColor, status.color
                  )}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Bitiş: {new Date(domain.expiresAt).toLocaleDateString("tr-TR")}
                  </span>
                  <span>•</span>
                  <span>{domain.registrar}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {domain.privacyEnabled && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-500">
                      <Lock className="h-3 w-3" />
                      Gizlilik
                    </span>
                  )}
                  {domain.autoRenew && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-500/10 text-purple-500">
                      <RefreshCcw className="h-3 w-3" />
                      Oto. Yenileme
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline">
                <RefreshCcw className="mr-2 h-4 w-4" />
                Yenile
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
              <Button variant="outline" className="justify-start h-auto py-3">
                <Settings className="mr-2 h-4 w-4 text-primary" />
                <div className="text-left">
                  <p className="font-medium">DNS Yönetimi</p>
                  <p className="text-xs text-muted-foreground">Kayıtları düzenle</p>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3">
                <Server className="mr-2 h-4 w-4 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Nameserver</p>
                  <p className="text-xs text-muted-foreground">NS değiştir</p>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3">
                <ArrowRightLeft className="mr-2 h-4 w-4 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Transfer</p>
                  <p className="text-xs text-muted-foreground">EPP kodu al</p>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3">
                <ExternalLink className="mr-2 h-4 w-4 text-primary" />
                <div className="text-left">
                  <p className="font-medium">WHOIS</p>
                  <p className="text-xs text-muted-foreground">Bilgileri görüntüle</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* DNS Records */}
          <BlurFade delay={0.2} inView>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-primary" />
                      DNS Kayıtları
                    </CardTitle>
                    <CardDescription>
                      Domain için tanımlı DNS kayıtları
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void handleSaveDnsRecords();
                      }}
                      disabled={isSavingDns}
                    >
                      {isSavingDns ? "Kaydediliyor..." : "DNS Kaydet"}
                    </Button>
                    <Button size="sm" onClick={handleAddDnsRecord}>
                      <Plus className="mr-2 h-4 w-4" />
                      Kayıt Ekle
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dnsRecords.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:shadow-sm transition-shadow"
                    >
                      <span className={cn(
                        "px-2 py-1 rounded text-xs font-bold text-white min-w-[50px] text-center",
                        dnsTypeColors[record.type] || "bg-gray-500"
                      )}>
                        {record.type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm font-medium">{record.name}</p>
                        <p className="font-mono text-xs text-muted-foreground truncate">
                          {record.value}
                        </p>
                      </div>
                      {record.priority !== null && (
                        <span className="text-xs text-muted-foreground">
                          Öncelik: {record.priority}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        TTL: {record.ttl}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditDnsRecord(record.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => handleDeleteDnsRecord(record.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {dnsRecords.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Henüz DNS kaydı bulunmuyor.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </BlurFade>

          {/* Nameservers */}
          <BlurFade delay={0.25} inView>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="h-5 w-5 text-primary" />
                      Nameservers
                    </CardTitle>
                    <CardDescription>
                      Domain için tanımlı isim sunucuları
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <Edit className="mr-2 h-4 w-4" />
                    Değiştir
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {domain.nameservers.map((ns, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-muted-foreground">
                          NS{index + 1}
                        </span>
                        <code className="font-mono text-sm">{ns}</code>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopy(ns)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {domain.nameservers.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      Nameserver tanımlı değil.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </BlurFade>

          {/* WHOIS Info */}
          <BlurFade delay={0.3} inView>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      WHOIS Bilgileri
                    </CardTitle>
                    <CardDescription>
                      {domain.privacyEnabled ? "Gizlilik koruması aktif - bilgiler gizli" : "Kayıt sahibi bilgileri"}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <Edit className="mr-2 h-4 w-4" />
                    Düzenle
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {domain.privacyEnabled ? (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Lock className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-blue-500">Gizlilik Koruması Aktif</p>
                      <p className="text-sm text-muted-foreground">
                        WHOIS bilgileriniz herkese açık sorgulamalarda gizlenir.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {domain.whoisName && (
                      <div className="flex items-start gap-3">
                        <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Kayıt Sahibi</p>
                          <p className="font-medium">{domain.whoisName}</p>
                        </div>
                      </div>
                    )}
                    {domain.whoisEmail && (
                      <div className="flex items-start gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">E-posta</p>
                          <p className="font-medium">{domain.whoisEmail}</p>
                        </div>
                      </div>
                    )}
                    {domain.whoisPhone && (
                      <div className="flex items-start gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Telefon</p>
                          <p className="font-medium">{domain.whoisPhone}</p>
                        </div>
                      </div>
                    )}
                    {domain.whoisAddress && (
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Adres</p>
                          <p className="font-medium">{domain.whoisAddress}</p>
                        </div>
                      </div>
                    )}
                    {!domain.whoisName && !domain.whoisEmail && !domain.whoisPhone && !domain.whoisAddress && (
                      <div className="col-span-2 text-center py-4 text-muted-foreground">
                        WHOIS bilgisi girilmemiş.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </BlurFade>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Domain Settings */}
          <BlurFade delay={0.35} inView>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Domain Ayarları</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCcw className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="auto-renew">Otomatik Yenileme</Label>
                  </div>
                  <Switch id="auto-renew" defaultChecked={domain.autoRenew} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="privacy">Gizlilik Koruması</Label>
                  </div>
                  <Switch id="privacy" defaultChecked={domain.privacyEnabled} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="transfer-lock">Transfer Kilidi</Label>
                  </div>
                  <Switch id="transfer-lock" defaultChecked={true} />
                </div>
              </CardContent>
            </Card>
          </BlurFade>

          {/* Domain Info */}
          <BlurFade delay={0.4} inView>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Domain Bilgileri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kayıt Tarihi</span>
                  <span className="font-medium">
                    {new Date(domain.registeredAt).toLocaleDateString("tr-TR")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bitiş Tarihi</span>
                  <span className="font-medium">
                    {new Date(domain.expiresAt).toLocaleDateString("tr-TR")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Registrar</span>
                  <span className="font-medium">{domain.registrar}</span>
                </div>

                <div className="pt-4 border-t space-y-2">
                  <Button className="w-full" variant="outline">
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Domaini Yenile
                  </Button>
                </div>
              </CardContent>
            </Card>
          </BlurFade>

          {/* Info Note */}
          <BlurFade delay={0.45} inView>
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">DNS Değişiklikleri</p>
                    <p>
                      DNS değişikliklerinin yayılması 24-48 saat sürebilir.
                      Değişikliklerinizi yaptıktan sonra sabırlı olun.
                    </p>
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
