"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ArrowRightLeft,
  Edit,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Plus,
  RefreshCcw,
  Server,
  Settings,
  Trash2,
} from "lucide-react";
import {
  AppBreadcrumbLabel,
  CopyButton,
  DetailList,
  EmptyState,
  IconTile,
  PageHeader,
  SectionCard,
  StatusBadge,
  UnavailableAction,
  appButton,
} from "@/components/app";
import { formatDate, daysUntil } from "@/lib/format/date";
import {
  addDnsRecord,
  deleteDnsRecord,
  updateDnsRecord,
  updateNameservers,
} from "@/lib/actions/customer/domains";
import { toast } from "@/lib/toast";
import type { DnsRecordType } from "@prisma/client";

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

  const daysLeft = daysUntil(domain.expiresAt);
  const whoisHref = `/domain/whois?domain=${encodeURIComponent(domain.name)}`;
  const hasWhois = Boolean(domain.whoisName || domain.whoisEmail || domain.whoisPhone || domain.whoisAddress);

  return (
    <>
      <AppBreadcrumbLabel segment={domain.id} label={domain.name} />

      <PageHeader
        back={{ href: "/musteri/panel/domainler", label: "Alan adlarım" }}
        eyebrow="Alan adı"
        title={
          <span className="flex items-center gap-3">
            <IconTile size="lg" className="hidden sm:flex">
              <Globe />
            </IconTile>
            <span className="break-all">{domain.name}</span>
          </span>
        }
        meta={
          <>
            <StatusBadge kind="domain" status={domain.status} size="md" />
            <span>
              Bitiş {formatDate(domain.expiresAt)}
              {daysLeft !== null && daysLeft >= 0 && daysLeft <= 60 ? ` · ${daysLeft} gün kaldı` : ""}
            </span>
            <span>{domain.registrar}</span>
            {domain.privacyEnabled ? <StatusBadge tone="neutral" label="Gizlilik koruması" /> : null}
            {domain.autoRenew ? <StatusBadge tone="neutral" label="Otomatik yenileme" /> : null}
          </>
        }
        actions={
          <>
            <UnavailableAction label="Yenile" icon={<RefreshCcw aria-hidden />} />
            <UnavailableAction label="Yönet" icon={<Settings aria-hidden />} />
          </>
        }
      />

      <SectionCard title="Hızlı işlemler">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <a
            href="#dns-kayitlari"
            className="flex min-h-[60px] items-center gap-3 rounded-md border bg-background px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Settings aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">DNS yönetimi</span>
              <span className="block text-xs text-muted-foreground">Kayıtları düzenle</span>
            </span>
          </a>
          <button
            type="button"
            onClick={openNsDialog}
            className="flex min-h-[60px] items-center gap-3 rounded-md border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Server aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">Nameserver</span>
              <span className="block text-xs text-muted-foreground">NS değiştir</span>
            </span>
          </button>
          <UnavailableAction layout="tile" label="Transfer" description="EPP kodu al" icon={<ArrowRightLeft aria-hidden />} />
          <Link
            href={whoisHref}
            className="flex min-h-[60px] items-center gap-3 rounded-md border bg-background px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">WHOIS</span>
              <span className="block text-xs text-muted-foreground">Herkese açık kaydı sorgula</span>
            </span>
          </Link>
        </div>
      </SectionCard>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SectionCard
            id="dns-kayitlari"
            title="DNS kayıtları"
            description="Alan adı için tanımlı DNS kayıtları"
            actions={
              <button type="button" onClick={openAddDnsDialog} className={appButton({ size: "sm" })}>
                <Plus aria-hidden />
                Kayıt ekle
              </button>
            }
            flush
            className="scroll-mt-20"
          >
            {dnsRecords.length === 0 ? (
              <EmptyState compact className="m-4" title="Henüz DNS kaydı yok" description="İlk kaydınızı ekleyerek başlayın." />
            ) : (
              <ul className="divide-y">
                {dnsRecords.map((record) => (
                  <li key={record.id} className="flex items-start gap-3 px-4 py-3 md:items-center md:px-5">
                    <span className="mt-0.5 inline-flex h-6 min-w-[52px] shrink-0 items-center justify-center rounded border bg-muted/50 font-mono text-[11px] font-semibold md:mt-0">
                      {record.type}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[13px] font-medium">{record.name}</p>
                      <p className="break-all font-mono text-xs text-muted-foreground">{record.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground md:hidden">
                        TTL {record.ttl}
                        {record.priority !== null ? ` · Öncelik ${record.priority}` : ""}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right font-mono text-[11px] text-muted-foreground md:block">
                      {record.priority !== null ? <p>Öncelik {record.priority}</p> : null}
                      <p>TTL {record.ttl}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        aria-label={`${record.type} ${record.name} kaydını düzenle`}
                        className={appButton({ variant: "ghost", size: "icon-sm" })}
                        onClick={() => openEditDnsDialog(record)}
                      >
                        <Edit aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`${record.type} ${record.name} kaydını sil`}
                        className={appButton({ variant: "ghost", size: "icon-sm", className: "text-red-600 dark:text-red-400" })}
                        onClick={() => void handleDeleteDnsRecord(record.id)}
                        disabled={deletingRecordId === record.id}
                      >
                        {deletingRecordId === record.id ? <Loader2 aria-hidden className="animate-spin" /> : <Trash2 aria-hidden />}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Nameserver"
            description="Alan adı için tanımlı isim sunucuları"
            actions={
              <button type="button" onClick={openNsDialog} className={appButton({ variant: "outline", size: "sm" })}>
                <Edit aria-hidden />
                Değiştir
              </button>
            }
          >
            {nameservers.length ? (
              <ul className="space-y-2">
                {nameservers.map((ns, index) => (
                  <li key={index} className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 py-1 pl-3 pr-1">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="font-mono text-[11px] text-muted-foreground">NS{index + 1}</span>
                      <code className="truncate font-mono text-[13px]">{ns}</code>
                    </span>
                    <CopyButton value={ns} label={`NS${index + 1} kopyala`} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nameserver tanımlı değil.</p>
            )}
          </SectionCard>

          <SectionCard
            title="WHOIS bilgileri"
            description={domain.privacyEnabled ? "Gizlilik koruması açık; bilgiler herkese açık sorgularda gizlenir." : "Kayıt sahibi bilgileri"}
            actions={<UnavailableAction label="Düzenle" size="sm" icon={<Edit aria-hidden />} />}
          >
            {domain.privacyEnabled ? (
              <div className="flex items-start gap-3 rounded-md border border-dashed p-4 text-sm">
                <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">Gizlilik koruması açık</p>
                  <p className="text-muted-foreground">WHOIS bilgileriniz herkese açık sorgulamalarda gizlenir.</p>
                </div>
              </div>
            ) : hasWhois ? (
              <DetailList
                layout="grid"
                items={[
                  { label: "Kayıt sahibi", value: domain.whoisName },
                  { label: "E-posta", value: domain.whoisEmail },
                  { label: "Telefon", value: domain.whoisPhone },
                  { label: "Adres", value: domain.whoisAddress },
                ]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">WHOIS bilgisi girilmemiş.</p>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Alan adı bilgileri">
            <DetailList
              items={[
                { label: "Kayıt tarihi", value: formatDate(domain.registeredAt) },
                { label: "Bitiş tarihi", value: formatDate(domain.expiresAt) },
                { label: "Kayıt firması", value: domain.registrar },
                {
                  label: "Otomatik yenileme",
                  value: <StatusBadge tone={domain.autoRenew ? "success" : "muted"} label={domain.autoRenew ? "Açık" : "Kapalı"} />,
                },
                {
                  label: "Gizlilik koruması",
                  value: <StatusBadge tone={domain.privacyEnabled ? "success" : "muted"} label={domain.privacyEnabled ? "Açık" : "Kapalı"} />,
                },
              ]}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Bu ayarları değiştirmek için destek talebi açabilirsiniz; panelden değiştirme yakında eklenecek.
            </p>
            <div className="mt-4 border-t pt-4">
              <UnavailableAction label="Alan adını yenile" icon={<RefreshCcw aria-hidden />} className="w-full" />
            </div>
          </SectionCard>

          <div className="rounded-lg border border-dashed p-4 text-sm">
            <p className="font-medium">DNS değişiklikleri</p>
            <p className="mt-1 text-muted-foreground">
              DNS değişikliklerinin internete yayılması 24–48 saat sürebilir.
            </p>
          </div>
        </div>
      </div>

      <Dialog open={isDnsDialogOpen} onOpenChange={setIsDnsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRecordId ? "DNS kaydını düzenle" : "DNS kaydı ekle"}</DialogTitle>
            <DialogDescription>Kayıt tipini, adını ve değerini girin.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dns-type">Kayıt tipi</Label>
              <Select
                value={dnsForm.type}
                onValueChange={(value) =>
                  setDnsForm((prev) => ({
                    ...prev,
                    type: value as DnsRecordType,
                  }))
                }
              >
                <SelectTrigger id="dns-type">
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
              <Label htmlFor="dns-name">Kayıt adı</Label>
              <Input
                id="dns-name"
                placeholder="@, www, mail"
                value={dnsForm.name}
                onChange={(e) => setDnsForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dns-value">Kayıt değeri</Label>
              <Input
                id="dns-value"
                placeholder="192.0.2.1 veya hedef adres"
                value={dnsForm.value}
                onChange={(e) => setDnsForm((prev) => ({ ...prev, value: e.target.value }))}
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
                  onChange={(e) => setDnsForm((prev) => ({ ...prev, ttl: e.target.value }))}
                />
              </div>
              {showPriorityField ? (
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
              ) : null}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              className={appButton({ variant: "outline" })}
              onClick={() => setIsDnsDialogOpen(false)}
              disabled={isDnsSubmitting}
            >
              Vazgeç
            </button>
            <button
              type="button"
              className={appButton()}
              onClick={() => void handleDnsSubmit()}
              disabled={isDnsSubmitting || !dnsForm.name.trim() || !dnsForm.value.trim()}
            >
              {isDnsSubmitting ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {isDnsSubmitting ? "Kaydediliyor…" : editingRecordId ? "Güncelle" : "Ekle"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNsDialogOpen} onOpenChange={setIsNsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nameserver değiştir</DialogTitle>
            <DialogDescription>
              En az iki nameserver girilmelidir. Değişiklikler kayıt firmasına iletilir.
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

          <DialogFooter className="gap-2">
            <button
              type="button"
              className={appButton({ variant: "outline" })}
              onClick={() => setIsNsDialogOpen(false)}
              disabled={isNsSubmitting}
            >
              Vazgeç
            </button>
            <button
              type="button"
              className={appButton()}
              onClick={() => void handleNsSubmit()}
              disabled={isNsSubmitting || nsForm.filter((ns) => ns.trim()).length < 2}
            >
              {isNsSubmitting ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {isNsSubmitting ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
