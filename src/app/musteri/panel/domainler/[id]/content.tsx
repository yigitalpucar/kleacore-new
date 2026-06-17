"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addDnsRecord,
  deleteDnsRecord,
  updateDnsRecord,
  updateNameservers,
} from "@/lib/actions/customer/domains";
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

const emptyDnsForm = {
  type: "A" as DnsRecordType,
  name: "@",
  value: "",
  ttl: "3600",
  priority: "10",
};

export function DomainDetayContent({ domain }: DomainDetayContentProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>(domain.dnsRecords);
  const [nameservers, setNameservers] = useState<string[]>(domain.nameservers);

  const [isDnsDialogOpen, setIsDnsDialogOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [dnsForm, setDnsForm] = useState(emptyDnsForm);
  const [isDnsSubmitting, setIsDnsSubmitting] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  const [isNsDialogOpen, setIsNsDialogOpen] = useState(false);
  const [nsForm, setNsForm] = useState<string[]>(["", ""]);
  const [isNsSubmitting, setIsNsSubmitting] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openAddDnsDialog = () => {
    setEditingRecordId(null);
    setDnsForm(emptyDnsForm);
    setIsDnsDialogOpen(true);
  };

  const openEditDnsDialog = (record: DnsRecord) => {
    setEditingRecordId(record.id);
    setDnsForm({
      type: record.type as DnsRecordType,
      name: record.name,
      value: record.value,
      ttl: String(record.ttl),
      priority: record.priority != null ? String(record.priority) : "10",
    });
    setIsDnsDialogOpen(true);
  };

  const handleDnsSubmit = async () => {
    if (isDnsSubmitting) return;

    if (!isDnsRecordType(dnsForm.type)) {
      toast.error("Geçersiz DNS kayıt tipi");
      return;
    }

    const ttl = Number.parseInt(dnsForm.ttl, 10);
    const priority =
      dnsForm.type === "MX" || dnsForm.type === "SRV"
        ? Number.parseInt(dnsForm.priority, 10)
        : undefined;

    const payload = {
      type: dnsForm.type,
      name: dnsForm.name.trim(),
      value: dnsForm.value.trim(),
      ttl: Number.isFinite(ttl) && ttl > 0 ? ttl : 3600,
      priority: Number.isFinite(priority) ? priority : undefined,
    };

    setIsDnsSubmitting(true);

    const result = editingRecordId
      ? await updateDnsRecord(domain.id, editingRecordId, payload)
      : await addDnsRecord(domain.id, payload);

    if (!result.success) {
      toast.error(result.error ?? "DNS kaydı kaydedilemedi");
      setIsDnsSubmitting(false);
      return;
    }

    toast.success(editingRecordId ? "DNS kaydı güncellendi" : "DNS kaydı eklendi");
    setIsDnsDialogOpen(false);
    setEditingRecordId(null);
    setDnsForm(emptyDnsForm);
    router.refresh();
    setIsDnsSubmitting(false);
  };

  const handleDeleteDnsRecord = async (recordId: string) => {
    const confirmed = window.confirm("Bu DNS kaydını silmek istediğinize emin misiniz?");
    if (!confirmed) return;

    setDeletingRecordId(recordId);
    const result = await deleteDnsRecord(domain.id, recordId);

    if (!result.success) {
      toast.error(result.error ?? "DNS kaydı silinemedi");
      setDeletingRecordId(null);
      return;
    }

    setDnsRecords((prev) => prev.filter((record) => record.id !== recordId));
    toast.success("DNS kaydı silindi");
    router.refresh();
    setDeletingRecordId(null);
  };

  const openNsDialog = () => {
    const current = nameservers.length >= 2 ? nameservers : ["", ""];
    setNsForm([...current, "", ""].slice(0, 4));
    setIsNsDialogOpen(true);
  };

  const handleNsSubmit = async () => {
    if (isNsSubmitting) return;

    setIsNsSubmitting(true);
    const result = await updateNameservers(domain.id, nsForm);

    if (!result.success) {
      toast.error(result.error ?? "Nameserver kayıtları güncellenemedi");
      setIsNsSubmitting(false);
      return;
    }

    const normalized = nsForm.map((ns) => ns.trim().toLowerCase()).filter(Boolean);
    setNameservers(normalized);
    toast.success("Nameserver kayıtları güncellendi");
    setIsNsDialogOpen(false);
    router.refresh();
    setIsNsSubmitting(false);
  };

  const showPriorityField = dnsForm.type === "MX" || dnsForm.type === "SRV";

  useEffect(() => {
    setDnsRecords(domain.dnsRecords);
    setNameservers(domain.nameservers);
  }, [domain.dnsRecords, domain.nameservers]);

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
                  <Button size="sm" onClick={openAddDnsDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Kayıt Ekle
                  </Button>
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
                          onClick={() => openEditDnsDialog(record)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => void handleDeleteDnsRecord(record.id)}
                          disabled={deletingRecordId === record.id}
                        >
                          {deletingRecordId === record.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
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
                  <Button variant="outline" size="sm" onClick={openNsDialog}>
                    <Edit className="mr-2 h-4 w-4" />
                    Değiştir
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {nameservers.map((ns, index) => (
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

                  {nameservers.length === 0 && (
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

      <Dialog open={isDnsDialogOpen} onOpenChange={setIsDnsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRecordId ? "DNS Kaydını Düzenle" : "DNS Kaydı Ekle"}
            </DialogTitle>
            <DialogDescription>
              DNS kayıt tipini DnsRecordType enum değerlerine göre seçin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Kayıt Tipi</Label>
              <Select
                value={dnsForm.type}
                onValueChange={(value) =>
                  setDnsForm((prev) => ({
                    ...prev,
                    type: value as DnsRecordType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedDnsTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dns-name">Kayıt Adı</Label>
              <Input
                id="dns-name"
                placeholder="@, www, mail"
                value={dnsForm.name}
                onChange={(e) =>
                  setDnsForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dns-value">Kayıt Değeri</Label>
              <Input
                id="dns-value"
                placeholder="192.0.2.1 veya hedef adres"
                value={dnsForm.value}
                onChange={(e) =>
                  setDnsForm((prev) => ({ ...prev, value: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dns-ttl">TTL (saniye)</Label>
                <Input
                  id="dns-ttl"
                  type="number"
                  min={60}
                  value={dnsForm.ttl}
                  onChange={(e) =>
                    setDnsForm((prev) => ({ ...prev, ttl: e.target.value }))
                  }
                />
              </div>
              {showPriorityField && (
                <div className="space-y-2">
                  <Label htmlFor="dns-priority">Öncelik</Label>
                  <Input
                    id="dns-priority"
                    type="number"
                    min={0}
                    value={dnsForm.priority}
                    onChange={(e) =>
                      setDnsForm((prev) => ({
                        ...prev,
                        priority: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDnsDialogOpen(false)}
              disabled={isDnsSubmitting}
            >
              İptal
            </Button>
            <Button
              onClick={() => void handleDnsSubmit()}
              disabled={
                isDnsSubmitting ||
                !dnsForm.name.trim() ||
                !dnsForm.value.trim()
              }
            >
              {isDnsSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isDnsSubmitting
                ? "Kaydediliyor..."
                : editingRecordId
                ? "Güncelle"
                : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNsDialogOpen} onOpenChange={setIsNsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nameserver Değiştir</DialogTitle>
            <DialogDescription>
              En az iki nameserver girilmelidir. Değişiklikler registrar&apos;a senkronize edilir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {nsForm.map((ns, index) => (
              <div key={index} className="space-y-2">
                <Label htmlFor={`ns-${index}`}>NS{index + 1}</Label>
                <Input
                  id={`ns-${index}`}
                  placeholder={`ns${index + 1}.ornek.com`}
                  value={ns}
                  onChange={(e) =>
                    setNsForm((prev) => {
                      const next = [...prev];
                      next[index] = e.target.value;
                      return next;
                    })
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNsDialogOpen(false)}
              disabled={isNsSubmitting}
            >
              İptal
            </Button>
            <Button
              onClick={() => void handleNsSubmit()}
              disabled={
                isNsSubmitting ||
                nsForm.filter((ns) => ns.trim()).length < 2
              }
            >
              {isNsSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isNsSubmitting ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
