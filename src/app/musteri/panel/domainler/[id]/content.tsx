"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  ArrowRightLeft,
  Edit,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Receipt,
  RefreshCcw,
  Server,
  Settings,
} from "lucide-react";
import {
  AppBreadcrumbLabel,
  CopyButton,
  DetailList,
  IconTile,
  PageHeader,
  SectionCard,
  StatusBadge,
  UnavailableAction,
  appButton,
} from "@/components/app";
import { formatDate, daysUntil } from "@/lib/format/date";
import {
  requestDomainRenewal,
  setDomainAutoRenew,
  updateNameservers,
} from "@/lib/actions/customer/domains";
import { toast } from "@/lib/toast";
import { DnsSection, type DnsRecordRow, type DnsState } from "./dns-section";

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
  dnsRecords: DnsRecordRow[];
}

interface CurrentRenewal {
  status: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
}

interface DomainDetayContentProps {
  domain: DomainDetail;
  dns: DnsState;
  renewal: CurrentRenewal | null;
}

const OPEN_INVOICE_STATUSES = new Set(["DRAFT", "PENDING", "OVERDUE"]);
const RENEWABLE_STATUSES = new Set(["ACTIVE", "EXPIRED"]);

export function DomainDetayContent({ domain, dns, renewal }: DomainDetayContentProps) {
  const router = useRouter();
  const [autoRenew, setAutoRenew] = useState(domain.autoRenew);
  const [autoRenewTarget, setAutoRenewTarget] = useState<boolean | null>(null);
  const [isAutoRenewSaving, setIsAutoRenewSaving] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [nameservers, setNameservers] = useState<string[]>(domain.nameservers);

  const [isNsDialogOpen, setIsNsDialogOpen] = useState(false);
  const [nsForm, setNsForm] = useState<string[]>(["", ""]);
  const [isNsSubmitting, setIsNsSubmitting] = useState(false);

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

  const openInvoice =
    renewal?.status === "PENDING" && renewal.invoiceId && renewal.invoiceStatus && OPEN_INVOICE_STATUSES.has(renewal.invoiceStatus)
      ? { id: renewal.invoiceId, number: renewal.invoiceNumber }
      : null;
  const renewalInProgress = renewal?.status === "PAID" || renewal?.status === "PROCESSING" || renewal?.status === "FAILED";
  const canRenew = RENEWABLE_STATUSES.has(domain.status) && !renewalInProgress;

  const handleRenewNow = async () => {
    if (isRenewing) return;
    if (openInvoice) {
      router.push(`/musteri/panel/faturalar/${openInvoice.id}`);
      return;
    }
    setIsRenewing(true);
    const result = await requestDomainRenewal(domain.id);
    if (!result.success) {
      toast.error(result.error);
      setIsRenewing(false);
      return;
    }
    toast.success(result.created ? "Yenileme faturanız oluşturuldu" : "Mevcut yenileme faturanız açılıyor");
    router.push(`/musteri/panel/faturalar/${result.invoiceId}`);
  };

  const handleAutoRenewConfirm = async () => {
    if (autoRenewTarget === null || isAutoRenewSaving) return;
    setIsAutoRenewSaving(true);
    const result = await setDomainAutoRenew(domain.id, autoRenewTarget);
    setIsAutoRenewSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setAutoRenew(result.autoRenew);
    setAutoRenewTarget(null);
    toast.success(result.autoRenew ? "Otomatik yenileme açıldı" : "Otomatik yenileme kapatıldı");
    router.refresh();
  };

  const renewLabel = openInvoice ? "Yenileme faturasını öde" : "Şimdi yenile";
  const renewDisabledReason = renewalInProgress
    ? "Yenileme ödendi, işleniyor"
    : !RENEWABLE_STATUSES.has(domain.status)
      ? "Bu durumda yenilenemez"
      : null;

  useEffect(() => {
    setNameservers(domain.nameservers);
  }, [domain.nameservers]);

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
            {autoRenew ? <StatusBadge tone="neutral" label="Otomatik yenileme" /> : null}
          </>
        }
        actions={
          canRenew ? (
            <button type="button" className={appButton()} onClick={() => void handleRenewNow()} disabled={isRenewing}>
              {isRenewing ? <Loader2 aria-hidden className="animate-spin" /> : openInvoice ? <Receipt aria-hidden /> : <RefreshCcw aria-hidden />}
              {renewLabel}
            </button>
          ) : (
            <UnavailableAction label="Şimdi yenile" icon={<RefreshCcw aria-hidden />} reason={renewDisabledReason ?? undefined} />
          )
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
          <DnsSection domain={{ id: domain.id, name: domain.name }} records={domain.dnsRecords} dns={dns} />

          <SectionCard
            title={dns.zone ? "Kayıt firmasındaki nameserver'lar" : "Nameserver"}
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
                  value: (
                    <span className="flex items-center gap-2">
                      <Switch
                        id="auto-renew"
                        checked={autoRenew}
                        onCheckedChange={(checked) => setAutoRenewTarget(checked)}
                        disabled={isAutoRenewSaving}
                        aria-label="Otomatik yenileme"
                      />
                      <span>{autoRenew ? "Açık" : "Kapalı"}</span>
                    </span>
                  ),
                },
                {
                  label: "Gizlilik koruması",
                  value: <StatusBadge tone={domain.privacyEnabled ? "success" : "muted"} label={domain.privacyEnabled ? "Açık" : "Kapalı"} />,
                },
              ]}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              {autoRenew
                ? "Bitişten 30 gün önce yenileme faturası kesilir; ödendiğinde alan adınız otomatik yenilenir."
                : "Otomatik yenileme kapalı: fatura kesilmez, yalnızca hatırlatma gönderilir."}{" "}
              Gizlilik koruması için destek talebi açabilirsiniz.
            </p>
            {openInvoice ? (
              <p className="mt-3 text-xs">
                Yenileme faturası ödeme bekliyor:{" "}
                <Link href={`/musteri/panel/faturalar/${openInvoice.id}`} className="font-mono underline underline-offset-2">
                  {openInvoice.number ?? "Faturayı görüntüle"}
                </Link>
              </p>
            ) : renewalInProgress ? (
              <p className="mt-3 text-xs text-muted-foreground">Yenileme ödendi; kayıt firmasında işleniyor.</p>
            ) : null}
            <div className="mt-4 border-t pt-4">
              {canRenew ? (
                <button
                  type="button"
                  className={appButton({ variant: "outline", className: "w-full" })}
                  onClick={() => void handleRenewNow()}
                  disabled={isRenewing}
                >
                  {isRenewing ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCcw aria-hidden />}
                  {renewLabel}
                </button>
              ) : (
                <UnavailableAction
                  label="Alan adını yenile"
                  icon={<RefreshCcw aria-hidden />}
                  reason={renewDisabledReason ?? undefined}
                  className="w-full"
                />
              )}
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

      <Dialog open={autoRenewTarget !== null} onOpenChange={(open) => (!open ? setAutoRenewTarget(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{autoRenewTarget ? "Otomatik yenileme açılsın mı?" : "Otomatik yenileme kapatılsın mı?"}</DialogTitle>
            <DialogDescription>
              {autoRenewTarget
                ? `${domain.name} için bitişten önce yenileme faturası otomatik kesilir; fatura ödendiğinde alan adınız kayıt firmasında yenilenir.`
                : `${domain.name} için yenileme faturası kesilmez. Süre dolmadan elle yenilemezseniz alan adınızı kaybedebilirsiniz; hatırlatma bildirimleri gönderilmeye devam eder.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              className={appButton({ variant: "outline" })}
              onClick={() => setAutoRenewTarget(null)}
              disabled={isAutoRenewSaving}
            >
              Vazgeç
            </button>
            <button
              type="button"
              className={appButton({ variant: autoRenewTarget ? "primary" : "destructive" })}
              onClick={() => void handleAutoRenewConfirm()}
              disabled={isAutoRenewSaving}
            >
              {isAutoRenewSaving ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {autoRenewTarget ? "Aç" : "Kapat"}
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
