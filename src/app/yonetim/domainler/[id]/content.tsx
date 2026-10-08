"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, Loader2, RefreshCcw, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AppBreadcrumbLabel,
  DetailList,
  EmptyState,
  IconTile,
  PageHeader,
  SectionCard,
  StatusBadge,
  ToneDot,
  appButton,
} from "@/components/app";
import { daysUntil, formatDate, formatDateTime } from "@/lib/format/date";
import { formatTRY } from "@/lib/format/price";
import { renewDomainAtRegistrar, syncDomainNow } from "@/lib/actions/admin/domains";
import { toast } from "@/lib/toast";
import { AdminDnsCard, type AdminDnsRecord, type AdminDnsZoneInfo } from "./dns-card";

interface DomainInfo {
  id: string;
  name: string;
  status: string;
  registrar: string;
  registeredAt: string;
  expiresAt: string;
  autoRenew: boolean;
  lastSyncedAt: string | null;
  nameservers: string[];
  dnsRecordCount: number;
  customer: { id: string; name: string; email: string };
}

interface RenewalRow {
  id: string;
  status: string;
  source: string;
  years: number;
  periodStart: string;
  newExpiresAt: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  invoice: { id: string; number: string; status: string; total: number } | null;
}

interface Props {
  domain: DomainInfo;
  dns: {
    provider: "registrar" | "cloudflare";
    hasDnsModule: boolean;
    zone: AdminDnsZoneInfo | null;
    records: AdminDnsRecord[];
  };
  renewals: RenewalRow[];
  notices: Array<{ id: string; kind: string; sentAt: string }>;
  events: Array<{ id: string; type: string; message: string; createdAt: string; actorId: string | null }>;
}

const SOURCE_LABELS: Record<string, string> = { cron: "Otomatik", customer: "Müşteri", admin: "Yönetici" };

const NOTICE_LABELS: Record<string, string> = {
  expiring_30: "30 gün kala",
  expiring_7: "7 gün kala",
  expiring_1: "1 gün kala",
  expired: "Süresi doldu",
  grace_ending: "Ek süre bitiyor",
  redemption: "Geri alma süreci",
};

function eventTone(type: string) {
  if (type.endsWith("failed")) return "danger" as const;
  if (type === "renewal.completed") return "success" as const;
  if (type.startsWith("sync")) return "info" as const;
  return "neutral" as const;
}

export function AdminDomainDetailContent({ domain, dns, renewals, notices, events }: Props) {
  const router = useRouter();
  const [confirmRenew, setConfirmRenew] = useState(false);
  const [busy, setBusy] = useState<"renew" | "sync" | null>(null);

  const daysLeft = daysUntil(domain.expiresAt);
  const paidRenewal = renewals.find((r) => ["PAID", "PROCESSING", "FAILED"].includes(r.status));

  const runRenew = async () => {
    setBusy("renew");
    const result = await renewDomainAtRegistrar(domain.id);
    setBusy(null);
    setConfirmRenew(false);
    if (result.success) toast.success(result.message);
    else toast.error(result.error);
    router.refresh();
  };

  const runSync = async () => {
    setBusy("sync");
    const result = await syncDomainNow(domain.id);
    setBusy(null);
    if (result.success) toast.success(result.message);
    else toast.error(result.error);
    router.refresh();
  };

  return (
    <>
      <AppBreadcrumbLabel segment={domain.id} label={domain.name} />

      <PageHeader
        back={{ href: "/yonetim/domainler", label: "Alan adları" }}
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
              {daysLeft !== null ? (daysLeft >= 0 ? ` · ${daysLeft} gün kaldı` : ` · ${-daysLeft} gün geçti`) : ""}
            </span>
            <span>{domain.registrar}</span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              className={appButton({ variant: "outline" })}
              onClick={() => void runSync()}
              disabled={busy !== null}
            >
              {busy === "sync" ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
              Senkronize et
            </button>
            <button
              type="button"
              className={appButton()}
              onClick={() => setConfirmRenew(true)}
              disabled={busy !== null}
            >
              <RefreshCcw aria-hidden />
              Registrar&apos;da yenile
            </button>
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <AdminDnsCard
            domain={{ id: domain.id, name: domain.name }}
            zone={dns.zone}
            records={dns.records}
            provider={dns.provider}
            hasDnsModule={dns.hasDnsModule}
          />

          <SectionCard title="Yenilemeler" description="Dönem başına yenileme faturası ve registrar durumu" flush>
            {renewals.length === 0 ? (
              <EmptyState compact className="m-4" title="Henüz yenileme yok" />
            ) : (
              <ul className="divide-y">
                {renewals.map((r) => (
                  <li key={r.id} className="space-y-1 px-4 py-3 text-sm md:px-5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <StatusBadge kind="domainRenewal" status={r.status} />
                      <span>
                        {formatDate(r.periodStart)} → {r.newExpiresAt ? formatDate(r.newExpiresAt) : `+${r.years} yıl`}
                      </span>
                      <span className="text-muted-foreground">{SOURCE_LABELS[r.source] ?? r.source}</span>
                      {r.invoice ? (
                        <Link href={`/yonetim/faturalar/${r.invoice.id}`} className="font-mono text-xs underline underline-offset-2">
                          {r.invoice.number} · {formatTRY(r.invoice.total, { keepDecimals: true })}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">Faturasız</span>
                      )}
                      {r.invoice ? <StatusBadge kind="invoice" status={r.invoice.status} /> : null}
                    </div>
                    {r.attempts > 0 || r.lastError ? (
                      <p className="text-xs text-muted-foreground">
                        {r.attempts} deneme{r.lastError ? ` · son hata: ${r.lastError}` : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Yaşam döngüsü" description="Yenileme, senkron ve bildirim geçmişi" flush>
            {events.length === 0 ? (
              <EmptyState compact className="m-4" title="Henüz kayıt yok" />
            ) : (
              <ol className="divide-y">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 px-4 py-3 text-sm md:px-5">
                    <ToneDot tone={eventTone(e.type)} className="mt-[7px]" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words">{e.message}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {formatDateTime(e.createdAt)} · {e.type}
                        {e.actorId ? (e.actorId === domain.customer.id ? " · müşteri" : " · yönetici") : " · sistem"}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Bilgiler">
            <DetailList
              items={[
                {
                  label: "Müşteri",
                  value: (
                    <Link href={`/yonetim/musteriler/${domain.customer.id}`} className="hover:underline">
                      {domain.customer.name}
                    </Link>
                  ),
                },
                { label: "Kayıt tarihi", value: formatDate(domain.registeredAt) },
                { label: "Bitiş tarihi", value: formatDate(domain.expiresAt) },
                {
                  label: "Otomatik yenileme",
                  value: <StatusBadge tone={domain.autoRenew ? "success" : "muted"} label={domain.autoRenew ? "Açık" : "Kapalı"} />,
                },
                { label: "Son senkron", value: domain.lastSyncedAt ? formatDateTime(domain.lastSyncedAt) : "Hiç" },
                { label: "Nameserver", value: domain.nameservers.join(", ") || "—", mono: true },
                { label: "DNS kaydı", value: String(domain.dnsRecordCount) },
              ]}
            />
          </SectionCard>

          <SectionCard title="Gönderilen bildirimler" flush>
            {notices.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground md:px-5">Henüz bildirim gönderilmedi.</p>
            ) : (
              <ul className="divide-y">
                {notices.map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm md:px-5">
                    <span>{NOTICE_LABELS[n.kind] ?? n.kind}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(n.sentAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <Dialog open={confirmRenew} onOpenChange={(open) => (busy ? undefined : setConfirmRenew(open))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar&apos;da yenilensin mi?</DialogTitle>
            <DialogDescription>
              {paidRenewal
                ? `${domain.name} için ödenmiş yenileme (${formatDate(paidRenewal.periodStart)} dönemi, ${paidRenewal.years} yıl) kayıt firmasında şimdi yenilenecek.`
                : `${domain.name} için ödenmiş bir yenileme yok. Devam ederseniz alan adı fatura kesilmeden 1 yıl yenilenir ve registrar ücreti firmaya yansır.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              className={appButton({ variant: "outline" })}
              onClick={() => setConfirmRenew(false)}
              disabled={busy !== null}
            >
              Vazgeç
            </button>
            <button type="button" className={appButton()} onClick={() => void runRenew()} disabled={busy !== null}>
              {busy === "renew" ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Yenile
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
