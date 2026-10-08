"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cloud, Loader2, RefreshCw, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, SectionCard, StatusBadge, appButton } from "@/components/app";
import { formatDateTime } from "@/lib/format/date";
import { adminDeleteDnsZone, adminEnsureDnsZone } from "@/lib/actions/admin/dns";
import { relativeRecordName, ttlLabel } from "@/lib/dns/validation";
import { toast } from "@/lib/toast";

export interface AdminDnsZoneInfo {
  status: string;
  providerZoneId: string;
  nameservers: string[];
  nameserversPointed: boolean;
  instance: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface AdminDnsRecord {
  id: string;
  type: string;
  name: string;
  value: string;
  ttl: number;
  priority: number | null;
  proxied: boolean;
  managedBy: string | null;
}

interface Props {
  domain: { id: string; name: string };
  zone: AdminDnsZoneInfo | null;
  records: AdminDnsRecord[];
  provider: "registrar" | "cloudflare";
  hasDnsModule: boolean;
}

export function AdminDnsCard({ domain, zone, records, provider, hasDnsModule }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"ensure" | "delete" | null>(null);
  const [confirm, setConfirm] = useState<"create" | "delete" | null>(null);

  const ensure = async () => {
    setBusy("ensure");
    const result = await adminEnsureDnsZone(domain.id);
    setBusy(null);
    setConfirm(null);
    if (result.success) toast.success(result.message);
    else toast.error(result.error);
    router.refresh();
  };

  const remove = async () => {
    setBusy("delete");
    const result = await adminDeleteDnsZone(domain.id);
    setBusy(null);
    setConfirm(null);
    if (result.success) toast.success("Zone Cloudflare'den silindi");
    else toast.error(result.error);
    router.refresh();
  };

  return (
    <>
      <SectionCard
        id="dns"
        title="DNS (Cloudflare)"
        description={
          zone
            ? `Zone ${zone.providerZoneId}${zone.instance ? ` · ${zone.instance}` : ""}${zone.lastSyncedAt ? ` · son eşitleme ${formatDateTime(zone.lastSyncedAt)}` : ""}`
            : provider === "cloudflare"
              ? "Bu alan adının DNS'i henüz Cloudflare'de değil."
              : "DNS kayıt firmasında (varsayılan). Zone oluşturmak yalnızca bu alan adını Cloudflare'e taşır."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {zone ? (
              <>
                <button
                  type="button"
                  className={appButton({ variant: "outline", size: "sm" })}
                  onClick={() => void ensure()}
                  disabled={busy !== null}
                >
                  {busy === "ensure" ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
                  Senkronize et
                </button>
                <button
                  type="button"
                  className={appButton({ variant: "outline", size: "sm", className: "text-red-600 dark:text-red-400" })}
                  onClick={() => setConfirm("delete")}
                  disabled={busy !== null}
                >
                  <Trash2 aria-hidden />
                  Zone&apos;u sil
                </button>
              </>
            ) : (
              <button
                type="button"
                className={appButton({ size: "sm" })}
                onClick={() => setConfirm("create")}
                disabled={busy !== null || !hasDnsModule}
                title={hasDnsModule ? undefined : "Etkin DNS modülü yok (Modüller)"}
              >
                <Cloud aria-hidden />
                Zone oluştur
              </button>
            )}
          </div>
        }
        flush
        className="scroll-mt-20"
      >
        {zone ? (
          <div className="space-y-2 border-b px-4 py-3 text-sm md:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge kind="dnsZone" status={zone.status} />
              {zone.nameserversPointed ? (
                <StatusBadge tone="success" label="NS Cloudflare'i gösteriyor" />
              ) : (
                <StatusBadge tone="warning" label="NS henüz çevrilmedi" />
              )}
            </div>
            <p className="font-mono text-xs text-muted-foreground">{zone.nameservers.join(", ") || "—"}</p>
            {zone.lastError ? <p className="text-xs text-muted-foreground">Son hata: {zone.lastError}</p> : null}
          </div>
        ) : null}
        {zone ? (
          records.length === 0 ? (
            <EmptyState compact className="m-4" title="Zone'da kayıt yok" />
          ) : (
            <ul className="divide-y">
              {records.map((record) => (
                <li key={record.id} className="flex items-start gap-3 px-4 py-2.5 text-sm md:px-5">
                  <span className="inline-flex h-6 min-w-[52px] shrink-0 items-center justify-center rounded border bg-muted/50 font-mono text-[11px] font-semibold">
                    {record.type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-mono text-[13px]">
                      {relativeRecordName(record.name, domain.name)}
                      {record.proxied ? <StatusBadge tone="info" label="Proxy" /> : null}
                      {record.managedBy ? <StatusBadge tone="neutral" label={`Otomatik · ${record.managedBy}`} /> : null}
                    </p>
                    <p className="break-all font-mono text-xs text-muted-foreground">{record.value}</p>
                  </div>
                  <div className="shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                    {record.priority !== null ? <p>Öncelik {record.priority}</p> : null}
                    <p>TTL {ttlLabel(record.ttl)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="px-4 py-3 text-sm text-muted-foreground md:px-5">{records.length} yerel (kayıt firması) DNS kaydı.</p>
        )}
      </SectionCard>

      <Dialog open={confirm !== null} onOpenChange={(open) => (busy ? undefined : !open ? setConfirm(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === "delete" ? "Cloudflare zone'u silinsin mi?" : "Cloudflare'de zone oluşturulsun mu?"}</DialogTitle>
            <DialogDescription>
              {confirm === "delete"
                ? `${domain.name} zone'u ve tüm kayıtları Cloudflare'den kalıcı olarak silinir. Nameserver'lar hâlâ Cloudflare'i gösteriyorsa site ve e-posta çalışmaz. Alan adı kayıt firması DNS moduna döner.`
                : `${domain.name} için bizim Cloudflare hesabımızda zone oluşturulur; mevcut yerel kayıtlar kopyalanır. Nameserver'lar değişmez, müşteri sayfasında Cloudflare nameserver'ları gösterilir.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button type="button" className={appButton({ variant: "outline" })} onClick={() => setConfirm(null)} disabled={busy !== null}>
              Vazgeç
            </button>
            <button
              type="button"
              className={appButton({ variant: confirm === "delete" ? "destructive" : "primary" })}
              onClick={() => void (confirm === "delete" ? remove() : ensure())}
              disabled={busy !== null}
            >
              {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {confirm === "delete" ? "Zone'u sil" : "Zone oluştur"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
