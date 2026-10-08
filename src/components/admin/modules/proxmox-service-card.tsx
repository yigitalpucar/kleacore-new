"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, FileText, Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import { DetailList, SectionCard, StatusBadge, appButton } from "@/components/app";
import { getProxmoxTaskLogAction, retryProxmoxProvisioningAction } from "@/lib/actions/admin/proxmox";
import { formatDateTime } from "@/lib/format/date";
import { toast } from "@/lib/toast";
import type { ProxmoxAdminView } from "@/lib/modules/server-panel";

const STEP_LABELS: Record<string, string> = {
  ip: "IP ayrıldı",
  cloning: "Klonlanıyor",
  cloned: "Klonlandı",
  configured: "Yapılandırıldı",
  resized: "Disk büyütüldü",
  done: "Tamamlandı",
};

const REINSTALL_LABELS: Record<string, string> = {
  queued: "Kuyrukta",
  destroy: "Eski VM siliniyor",
  provision: "Yeniden kuruluyor",
  done: "Tamamlandı",
  failed: "Başarısız",
};

/**
 * Service detail → Proxmox: VMID, node, provisioning progress and errors,
 * last task log, link to the VM in the PVE UI and "Proxmox'ta yeniden dene".
 */
export function ProxmoxServiceCard({ serviceId, view }: { serviceId: string; view: ProxmoxAdminView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [log, setLog] = useState<{ upid: string; lines: string[] } | null>(null);
  const [logPending, startLog] = useTransition();

  const job = view.provisioningJob;
  const canRetry = Boolean(job && (job.status === "FAILED" || job.status === "PENDING"));

  const retry = () => {
    if (!window.confirm("Kurulum Proxmox'ta kaldığı yerden yeniden denenecek (mevcut VM kullanılır, ikinci klon açılmaz). Devam edilsin mi?")) {
      return;
    }
    start(async () => {
      const result = await retryProxmoxProvisioningAction(serviceId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  };

  const loadLog = () =>
    startLog(async () => {
      const result = await getProxmoxTaskLogAction(serviceId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setLog({ upid: result.upid, lines: result.lines });
    });

  return (
    <SectionCard
      title="Proxmox"
      description="VDS'in Proxmox VE üzerindeki durumu. VM'ler hiçbir zaman otomatik silinmez."
      actions={
        view.pveUrl ? (
          <a href={view.pveUrl} target="_blank" rel="noopener noreferrer" className={appButton({ variant: "outline", size: "sm" })}>
            <ExternalLink aria-hidden />
            Proxmox’ta aç
            <span className="sr-only">(yeni sekmede açılır)</span>
          </a>
        ) : undefined
      }
      footer={
        <>
          <button
            type="button"
            className={appButton({ variant: "ghost", size: "sm" })}
            onClick={loadLog}
            disabled={logPending || !view.lastUpid}
            title={view.lastUpid ? undefined : "Kayıtlı görev yok"}
          >
            {logPending ? <Loader2 aria-hidden className="animate-spin" /> : <FileText aria-hidden />}
            Son görev kaydı
          </button>
          <button
            type="button"
            className={appButton({ size: "sm" })}
            onClick={retry}
            disabled={pending || !canRetry}
            title={canRetry ? undefined : "Bekleyen veya başarısız kurulum işi yok"}
          >
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : <RotateCcw aria-hidden />}
            Proxmox’ta yeniden dene
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {view.needsAdmin ? (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-dashed border-amber-500/60 p-3 text-sm">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>{view.needsAdmin}</p>
          </div>
        ) : null}
        <DetailList
          layout="grid"
          items={[
            { label: "VMID", value: view.vmid, mono: true, copy: view.vmid ?? undefined },
            { label: "Node", value: view.node, mono: true },
            { label: "Kurulum adımı", value: view.step ? (STEP_LABELS[view.step] ?? view.step) : null },
            {
              label: "Kurulum işi",
              value: job ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <StatusBadge kind="provisioning" status={job.status} />
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {job.attempts}/{job.maxAttempts} deneme
                  </span>
                </span>
              ) : null,
            },
            {
              label: "Yeniden kurulum",
              value: view.reinstall
                ? `${REINSTALL_LABELS[view.reinstall.phase] ?? view.reinstall.phase}${view.reinstall.requestedAt ? ` · ${formatDateTime(view.reinstall.requestedAt)}` : ""}`
                : null,
            },
            {
              label: "Son hata",
              value: view.lastError ? (
                <span className="break-words">
                  {view.lastError}
                  {view.lastErrorAt ? <span className="block text-xs text-muted-foreground">{formatDateTime(view.lastErrorAt)}</span> : null}
                </span>
              ) : null,
            },
          ]}
        />
        {log ? (
          <div className="space-y-1">
            <p className="break-all font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{log.upid}</p>
            <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
              {log.lines.length ? log.lines.join("\n") : "Kayıt boş."}
            </pre>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
