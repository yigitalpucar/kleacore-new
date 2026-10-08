"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Cloud, Edit, Loader2, Lock, Plus, RefreshCcw, Server, Trash2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyButton, EmptyState, SectionCard, StatusBadge, appButton } from "@/components/app";
import { formatDateTime } from "@/lib/format/date";
import {
  addDnsRecord,
  deleteDnsRecord,
  enableCloudflareDns,
  refreshDnsZone,
  switchNameserversToCloudflare,
  updateDnsRecord,
} from "@/lib/actions/customer/domains";
import {
  DNS_EDITOR_TYPES,
  DNS_PROXIABLE_TYPES,
  DNS_TTL_OPTIONS,
  DNS_TYPE_HINTS,
  relativeRecordName,
  ttlLabel,
  validateDnsRecord,
  type DnsEditorType,
  type DnsField,
} from "@/lib/dns/validation";
import { toast } from "@/lib/toast";
import type { DnsRecordType } from "@prisma/client";

export interface DnsRecordRow {
  id: string;
  type: string;
  name: string;
  value: string;
  ttl: number;
  priority: number | null;
  proxied: boolean;
  managed: boolean;
}

export interface DnsState {
  mode: "cloudflare" | "registrar";
  canEnableCloudflare: boolean;
  zone: { status: string; nameservers: string[]; lastSyncedAt: string | null; nameserversPointed: boolean } | null;
  canSwitchNameservers: boolean;
  syncError: string | null;
}

interface DnsSectionProps {
  domain: { id: string; name: string };
  records: DnsRecordRow[];
  dns: DnsState;
}

interface FormState {
  type: DnsEditorType;
  name: string;
  value: string;
  ttl: string;
  priority: string;
  proxied: boolean;
}

function emptyForm(cloudflare: boolean): FormState {
  return { type: "A", name: "@", value: "", ttl: cloudflare ? "1" : "3600", priority: "10", proxied: false };
}

export function DnsSection({ domain, records, dns }: DnsSectionProps) {
  const router = useRouter();
  const cloudflare = dns.mode === "cloudflare";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(cloudflare));
  const [fieldError, setFieldError] = useState<{ field: DnsField; error: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DnsRecordRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirm, setConfirm] = useState<"enable" | "switch" | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const ttlOptions = useMemo(() => DNS_TTL_OPTIONS.filter((option) => cloudflare || option.value !== 1), [cloudflare]);
  const typeHint = DNS_TYPE_HINTS[form.type];
  const showPriority = form.type === "MX" || form.type === "SRV";
  const canProxy = cloudflare && DNS_PROXIABLE_TYPES.includes(form.type);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm(cloudflare));
    setFieldError(null);
    setDialogOpen(true);
  };

  const openEdit = (record: DnsRecordRow) => {
    setEditingId(record.id);
    setForm({
      type: (DNS_EDITOR_TYPES as readonly string[]).includes(record.type) ? (record.type as DnsEditorType) : "A",
      name: relativeRecordName(record.name, domain.name),
      value: record.value,
      ttl: String(record.ttl),
      priority: record.priority != null ? String(record.priority) : "10",
      proxied: record.proxied,
    });
    setFieldError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const ttl = Number.parseInt(form.ttl, 10);
    const priority = showPriority ? Number.parseInt(form.priority, 10) : undefined;
    const input = {
      type: form.type,
      name: form.name,
      value: form.value,
      ttl: Number.isFinite(ttl) ? ttl : undefined,
      priority: Number.isFinite(priority) ? priority : undefined,
      proxied: canProxy ? form.proxied : false,
    };
    const checked = validateDnsRecord(input, domain.name, { provider: cloudflare ? "cloudflare" : "registrar" });
    if (!checked.ok) {
      setFieldError({ field: checked.field, error: checked.error });
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    const payload = { ...input, type: form.type as DnsRecordType };
    const result = editingId
      ? await updateDnsRecord(domain.id, editingId, payload)
      : await addDnsRecord(domain.id, payload);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? "DNS kaydı kaydedilemedi");
      return;
    }
    toast.success(editingId ? "DNS kaydı güncellendi" : "DNS kaydı eklendi");
    setDialogOpen(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const result = await deleteDnsRecord(domain.id, deleteTarget.id);
    setDeleting(false);
    if (!result.success) {
      toast.error(result.error ?? "DNS kaydı silinemedi");
      return;
    }
    toast.success("DNS kaydı silindi");
    setDeleteTarget(null);
    router.refresh();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const result = await refreshDnsZone(domain.id);
    setRefreshing(false);
    if (!result.success) {
      toast.error(result.error ?? "İşlem başarısız oldu");
      return;
    }
    toast.success("Kayıtlar Cloudflare'den yenilendi");
    router.refresh();
  };

  const handleConfirm = async () => {
    if (!confirm || confirmBusy) return;
    setConfirmBusy(true);
    if (confirm === "enable") {
      const result = await enableCloudflareDns(domain.id);
      setConfirmBusy(false);
      if (!result.success) {
        toast.error(result.error ?? "İşlem başarısız oldu");
        return;
      }
      if (result.importErrors.length) {
        toast.error(`${result.importErrors.length} kayıt aktarılamadı; kayıtları kontrol edin`);
      } else {
        toast.success("DNS bölgesi Cloudflare'de oluşturuldu");
      }
    } else {
      const result = await switchNameserversToCloudflare(domain.id);
      setConfirmBusy(false);
      if (!result.success) {
        toast.error(result.error ?? "İşlem başarısız oldu");
        return;
      }
      toast.success(result.unchanged ? "Nameserver'lar zaten Cloudflare'i gösteriyor" : "Nameserver'lar Cloudflare'e çevrildi");
    }
    setConfirm(null);
    router.refresh();
  };

  const fieldMessage = (field: DnsField) =>
    fieldError?.field === field ? (
      <p id={`dns-${field}-error`} className="text-xs text-red-600 dark:text-red-400">
        {fieldError.error}
      </p>
    ) : null;

  return (
    <>
      {dns.zone ? (
        <SectionCard
          title="Nameserver'lar"
          description={
            dns.zone.nameserversPointed
              ? "DNS'iniz Cloudflare'de; alan adınız aşağıdaki nameserver'ları kullanıyor."
              : "DNS kayıtlarınızın çalışması için alan adınızın kayıt firmasında nameserver'ları aşağıdakilerle değiştirin."
          }
          actions={<StatusBadge kind="dnsZone" status={dns.zone.status} />}
        >
          <ul className="space-y-2">
            {dns.zone.nameservers.map((ns, index) => (
              <li key={ns} className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 py-1 pl-3 pr-1">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="font-mono text-[11px] text-muted-foreground">NS{index + 1}</span>
                  <code className="truncate font-mono text-[13px]">{ns}</code>
                </span>
                <CopyButton value={ns} label={`NS${index + 1} kopyala`} />
              </li>
            ))}
          </ul>
          {!dns.zone.nameserversPointed ? (
            <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {dns.canSwitchNameservers
                  ? "Alan adınız bizden kayıtlı; nameserver'ları tek tıkla çevirebilirsiniz."
                  : "Alan adınız başka bir firmada kayıtlıysa bu değişikliği o firmanın panelinden yapın."}{" "}
                Değişikliğin yayılması 24–48 saat sürebilir.
              </p>
              {dns.canSwitchNameservers ? (
                <button type="button" className={appButton({ size: "sm" })} onClick={() => setConfirm("switch")}>
                  <Server aria-hidden />
                  Nameserver&apos;ları Cloudflare&apos;e çevir
                </button>
              ) : null}
            </div>
          ) : null}
        </SectionCard>
      ) : dns.canEnableCloudflare ? (
        <SectionCard
          title="Cloudflare DNS"
          description="DNS kayıtlarınızı Cloudflare altyapımızda yönetin: hızlı yayılma, proxy (turuncu bulut) ve hosting kayıtlarının otomatik kurulması."
          actions={
            <button type="button" className={appButton({ size: "sm" })} onClick={() => setConfirm("enable")}>
              <Cloud aria-hidden />
              DNS&apos;i Cloudflare&apos;de yönet
            </button>
          }
        >
          <p className="text-sm text-muted-foreground">
            Mevcut kayıtlarınız Cloudflare&apos;e kopyalanır. Kayıtların etkin olması için ardından nameserver&apos;ları
            değiştirmeniz gerekir.
          </p>
        </SectionCard>
      ) : null}

      <SectionCard
        id="dns-kayitlari"
        title="DNS kayıtları"
        description={
          cloudflare
            ? `Cloudflare'de yönetiliyor${dns.zone?.lastSyncedAt ? ` · son eşitleme ${formatDateTime(dns.zone.lastSyncedAt)}` : ""}`
            : "Alan adı için tanımlı DNS kayıtları"
        }
        actions={
          <div className="flex gap-2">
            {cloudflare ? (
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className={appButton({ variant: "outline", size: "sm" })}
                disabled={refreshing}
              >
                {refreshing ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCcw aria-hidden />}
                Yenile
              </button>
            ) : null}
            <button type="button" onClick={openAdd} className={appButton({ size: "sm" })}>
              <Plus aria-hidden />
              Kayıt ekle
            </button>
          </div>
        }
        flush
        className="scroll-mt-20"
      >
        {dns.syncError ? (
          <p className="border-b px-4 py-3 text-xs text-muted-foreground md:px-5">
            Kayıtlar Cloudflare&apos;den yenilenemedi ({dns.syncError}); son bilinen kayıtlar gösteriliyor.
          </p>
        ) : null}
        {records.length === 0 ? (
          <EmptyState compact className="m-4" title="Henüz DNS kaydı yok" description="İlk kaydınızı ekleyerek başlayın." />
        ) : (
          <ul className="divide-y">
            {records.map((record) => {
              const displayName = relativeRecordName(record.name, domain.name);
              const label = `${record.type} ${displayName}`;
              return (
                <li key={record.id} className="flex items-start gap-3 px-4 py-3 md:items-center md:px-5">
                  <span className="mt-0.5 inline-flex h-6 min-w-[52px] shrink-0 items-center justify-center rounded border bg-muted/50 font-mono text-[11px] font-semibold md:mt-0">
                    {record.type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-mono text-[13px] font-medium">
                      {displayName}
                      {record.proxied ? <StatusBadge tone="info" label="Proxy" /> : null}
                      {record.managed ? <StatusBadge tone="neutral" label="Otomatik" /> : null}
                    </p>
                    <p className="break-all font-mono text-xs text-muted-foreground">{record.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground md:hidden">
                      TTL {ttlLabel(record.ttl)}
                      {record.priority !== null ? ` · Öncelik ${record.priority}` : ""}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right font-mono text-[11px] text-muted-foreground md:block">
                    {record.priority !== null ? <p>Öncelik {record.priority}</p> : null}
                    <p>TTL {ttlLabel(record.ttl)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {record.managed ? (
                      <span
                        className="inline-flex size-9 items-center justify-center text-muted-foreground md:size-8"
                        title="Hosting/sunucu hizmetiniz için otomatik yönetiliyor; değiştirilemez veya silinemez"
                        aria-label={`${label} kaydı korumalı`}
                        role="img"
                      >
                        <Lock aria-hidden className="size-4" />
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-label={`${label} kaydını düzenle`}
                          className={appButton({ variant: "ghost", size: "icon-sm" })}
                          onClick={() => openEdit(record)}
                        >
                          <Edit aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label={`${label} kaydını sil`}
                          className={appButton({ variant: "ghost", size: "icon-sm", className: "text-red-600 dark:text-red-400" })}
                          onClick={() => setDeleteTarget(record)}
                        >
                          <Trash2 aria-hidden />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "DNS kaydını düzenle" : "DNS kaydı ekle"}</DialogTitle>
            <DialogDescription>
              Kayıt adı {domain.name} altında olur; kök alan adı için @ yazın.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="dns-type">Kayıt tipi</Label>
              <Select
                value={form.type}
                onValueChange={(value) => {
                  setFieldError(null);
                  setForm((prev) => ({ ...prev, type: value as DnsEditorType, proxied: false }));
                }}
              >
                <SelectTrigger id="dns-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DNS_EDITOR_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dns-name">Kayıt adı</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="dns-name"
                  placeholder={form.type === "SRV" ? "_sip._tcp" : "@, www, mail"}
                  value={form.name}
                  aria-invalid={fieldError?.field === "name"}
                  aria-describedby={fieldError?.field === "name" ? "dns-name-error" : undefined}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                <span className="shrink-0 font-mono text-xs text-muted-foreground">.{domain.name}</span>
              </div>
              {fieldMessage("name")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dns-value">{typeHint.value}</Label>
              <Input
                id="dns-value"
                placeholder={typeHint.placeholder}
                value={form.value}
                aria-invalid={fieldError?.field === "value"}
                aria-describedby={fieldError?.field === "value" ? "dns-value-error" : undefined}
                onChange={(e) => setForm((prev) => ({ ...prev, value: e.target.value }))}
              />
              {fieldMessage("value")}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dns-ttl">TTL</Label>
                <Select
                  value={form.proxied && canProxy ? "1" : form.ttl}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, ttl: value }))}
                  disabled={form.proxied && canProxy}
                >
                  <SelectTrigger id="dns-ttl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ttlOptions.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                    {!ttlOptions.some((option) => String(option.value) === form.ttl) ? (
                      <SelectItem value={form.ttl}>{form.ttl} sn</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
                {fieldMessage("ttl")}
              </div>
              {showPriority ? (
                <div className="space-y-2">
                  <Label htmlFor="dns-priority">Öncelik</Label>
                  <Input
                    id="dns-priority"
                    type="number"
                    min={0}
                    max={65535}
                    value={form.priority}
                    aria-invalid={fieldError?.field === "priority"}
                    onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                  />
                  {fieldMessage("priority")}
                </div>
              ) : null}
            </div>

            {canProxy ? (
              <div className="flex items-start justify-between gap-4 rounded-md border p-3">
                <div>
                  <Label htmlFor="dns-proxied">Cloudflare proxy (turuncu bulut)</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Web trafiği Cloudflare üzerinden geçer, sunucu IP&apos;si gizlenir. Mail, FTP ve SSH için kapalı tutun.
                  </p>
                  {fieldMessage("proxied")}
                </div>
                <Switch
                  id="dns-proxied"
                  checked={form.proxied}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, proxied: checked }))}
                />
              </div>
            ) : null}

            <DialogFooter className="gap-2">
              <button
                type="button"
                className={appButton({ variant: "outline" })}
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Vazgeç
              </button>
              <button type="submit" className={appButton()} disabled={submitting || !form.value.trim()}>
                {submitting ? <Loader2 aria-hidden className="animate-spin" /> : null}
                {submitting ? "Kaydediliyor…" : editingId ? "Güncelle" : "Ekle"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => (!open ? setDeleteTarget(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>DNS kaydı silinsin mi?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `${deleteTarget.type} ${relativeRecordName(deleteTarget.name, domain.name)} → ${deleteTarget.value} kaydı kalıcı olarak silinir. Bu kayda bağlı site veya e-posta çalışmayı durdurabilir.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button type="button" className={appButton({ variant: "outline" })} onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Vazgeç
            </button>
            <button type="button" className={appButton({ variant: "destructive" })} onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? <Loader2 aria-hidden className="animate-spin" /> : <Trash2 aria-hidden />}
              Sil
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm !== null} onOpenChange={(open) => (!open ? setConfirm(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "switch" ? "Nameserver'lar Cloudflare'e çevrilsin mi?" : "DNS Cloudflare'e taşınsın mı?"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "switch"
                ? `${domain.name} için kayıt firmasındaki nameserver'lar ${dns.zone?.nameservers.join(", ") ?? ""} olarak değiştirilir. Bundan sonra DNS kayıtlarınız yalnızca bu sayfadan yönetilir; eski DNS sağlayıcınızdaki kayıtlar kullanılmaz. Yayılma 24–48 saat sürebilir.`
                : `${domain.name} için Cloudflare'de bir DNS bölgesi oluşturulur ve mevcut kayıtlarınız kopyalanır. Nameserver'ları değiştirene kadar sitenize ve e-postanıza etkisi olmaz.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button type="button" className={appButton({ variant: "outline" })} onClick={() => setConfirm(null)} disabled={confirmBusy}>
              Vazgeç
            </button>
            <button type="button" className={appButton()} onClick={() => void handleConfirm()} disabled={confirmBusy}>
              {confirmBusy ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {confirm === "switch" ? "Nameserver'ları çevir" : "Bölgeyi oluştur"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
