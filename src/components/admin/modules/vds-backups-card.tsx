"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, CalendarPlus, Loader2, Plus, RotateCcw, Save, Trash2, TriangleAlert } from "lucide-react";
import { EmptyState, SectionCard, StatusBadge, appButton } from "@/components/app";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminCreateVdsBackupAction,
  adminDeleteVdsBackupAction,
  adminRestoreVdsBackupAction,
  extendFinalBackupAction,
  retryFinalBackupAction,
  setVdsExtraBackupSlotsAction,
  terminateWithoutFinalBackupAction,
} from "@/lib/actions/admin/backups";
import type { AdminVdsBackupRow, AdminVdsBackupsView } from "@/lib/backups/vds";
import { formatDateTime } from "@/lib/format/date";
import { vmNameFor } from "@/lib/modules/server/proxmox/names";
import { toast } from "@/lib/toast";

const TRIGGER_LABELS: Record<AdminVdsBackupRow["trigger"], string> = {
  MANUAL: "Manuel",
  SCHEDULED: "Otomatik",
  FINAL: "Fesih öncesi (son yedek)",
};

const RESTORE_LABELS: Record<string, string> = {
  queued: "Geri yükleme sırada",
  running: "Geri yükleniyor",
  done: "Geri yüklendi",
  failed: "Geri yükleme başarısız",
};

function formatSize(mb: number | null) {
  if (!mb) return "—";
  return mb >= 1024 ? `${(mb / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} GB` : `${Math.round(mb)} MB`;
}

/**
 * Admin service detail → VDS backups: every archive (incl. the final backup
 * before termination and deleted ones), restore (also a final backup into a
 * new service), delete, extra slots, final-backup expiry, and for a
 * cancelled VDS whose VM still exists: retry the final backup or destroy
 * without it. Actions need backups.manage.
 */
export function VdsBackupsAdminCard({
  serviceId,
  serviceStatus,
  vmPending,
  view,
  canManage,
}: {
  serviceId: string;
  serviceStatus: string;
  /** Cancelled but the VM is not destroyed yet (final backup pending / failed). */
  vmPending: boolean;
  view: AdminVdsBackupsView;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [extra, setExtra] = useState(String(view.extra));
  const [restore, setRestore] = useState<AdminVdsBackupRow | null>(null);
  const [targetId, setTargetId] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [destroyOpen, setDestroyOpen] = useState(false);
  const [destroyConfirmation, setDestroyConfirmation] = useState("");

  const run = (action: () => Promise<{ success: boolean; error?: string }>, success: string, after?: () => void) =>
    start(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error ?? "İşlem başarısız");
        return;
      }
      toast.success(success);
      after?.();
      router.refresh();
    });

  const live = view.backups.filter((b) => !b.deletedAt);
  const finals = view.backups.filter((b) => b.trigger === "FINAL");
  const finalInFlight = finals.some((b) => !b.deletedAt && (b.status === "SCHEDULED" || b.status === "IN_PROGRESS"));
  const finalFailed = !finalInFlight && finals.some((b) => !b.deletedAt && b.status === "FAILED") && !finals.some((b) => !b.deletedAt && b.status === "COMPLETED");
  const restoreTargetId = restore?.trigger === "FINAL" && targetId.trim() ? targetId.trim() : serviceId;
  const expectedName = vmNameFor(restoreTargetId);
  const used = live.filter((b) => b.trigger !== "FINAL" && b.status !== "FAILED").length;

  return (
    <SectionCard
      title="Sunucu yedekleri"
      description={`Hak: ${view.included} pakette + ${view.extra} ek = ${view.quota} (kullanılan ${used}). Fesih yedeği ${view.finalKeepDays} gün saklanır.`}
      actions={
        canManage && serviceStatus === "ACTIVE" ? (
          <button
            type="button"
            className={appButton({ variant: "outline", size: "sm" })}
            disabled={busy}
            onClick={() => run(() => adminCreateVdsBackupAction(serviceId), "Yedek sıraya alındı")}
          >
            {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Plus aria-hidden />}
            Şimdi yedek al
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {vmPending ? (
          <div role="alert" className="space-y-3 rounded-md border border-dashed border-amber-500/60 p-3 text-sm">
            <p className="flex items-start gap-2">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
              {finalInFlight
                ? "Hizmet iptal edildi; son yedek alınıyor. Yedek tamamlanınca VM otomatik silinecek."
                : finalFailed
                  ? "Hizmet iptal edildi ama son yedek alınamadı; VM silinmedi."
                  : "Hizmet iptal edildi; VM henüz silinmedi."}
            </p>
            {canManage ? (
              <div className="flex flex-wrap gap-2">
                {!finalInFlight ? (
                  <button
                    type="button"
                    className={appButton({ size: "sm" })}
                    disabled={busy}
                    onClick={() => run(() => retryFinalBackupAction(serviceId), "Son yedek yeniden sıraya alındı")}
                  >
                    <RotateCcw aria-hidden />
                    Son yedeği yeniden dene
                  </button>
                ) : null}
                <button
                  type="button"
                  className={appButton({ variant: "destructive", size: "sm" })}
                  disabled={busy}
                  onClick={() => {
                    setDestroyConfirmation("");
                    setDestroyOpen(true);
                  }}
                >
                  <Trash2 aria-hidden />
                  Yedeksiz sil
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {view.finalBackupSkippedAt ? (
          <p className="text-sm text-muted-foreground">Son yedek {formatDateTime(view.finalBackupSkippedAt)} tarihinde yönetici kararıyla atlandı.</p>
        ) : null}

        {view.backups.length === 0 ? (
          <EmptyState compact icon={Archive} title="Henüz yedek yok" />
        ) : (
          <ul className="divide-y rounded-md border">
            {view.backups.map((b) => (
              <li key={b.id} className={`space-y-2 p-3 text-sm ${b.deletedAt ? "text-muted-foreground" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium tabular-nums">{formatDateTime(b.completedAt ?? b.createdAt)}</span>
                  <span>{TRIGGER_LABELS[b.trigger]}</span>
                  <span className="tabular-nums">{formatSize(b.sizeMB)}</span>
                  {b.deletedAt ? <span>· silindi {formatDateTime(b.deletedAt)}</span> : <StatusBadge kind="backup" status={b.status} />}
                  {b.restoreStatus ? <span className="text-xs">· {RESTORE_LABELS[b.restoreStatus] ?? b.restoreStatus}</span> : null}
                </div>
                {b.volid ? <p className="break-all font-mono text-xs text-muted-foreground">{b.volid}{b.node ? ` · ${b.node}` : ""}</p> : null}
                {b.trigger === "FINAL" && b.expiresAt && !b.deletedAt ? (
                  <p className="text-xs">Saklama sonu: {formatDateTime(b.expiresAt)}</p>
                ) : null}
                {b.rawError ? <p className="break-words text-xs text-red-600">{b.rawError}</p> : null}
                {b.rawRestoreError ? <p className="break-words text-xs text-red-600">Geri yükleme: {b.rawRestoreError}</p> : null}
                {canManage && !b.deletedAt ? (
                  <div className="flex flex-wrap gap-2">
                    {b.status === "COMPLETED" ? (
                      <button
                        type="button"
                        className={appButton({ variant: "outline", size: "sm" })}
                        disabled={busy || b.restoreStatus === "queued" || b.restoreStatus === "running"}
                        onClick={() => {
                          setTargetId("");
                          setConfirmation("");
                          setRestore(b);
                        }}
                      >
                        <RotateCcw aria-hidden />
                        Geri yükle
                      </button>
                    ) : null}
                    {b.trigger === "FINAL" && b.status === "COMPLETED" ? (
                      <button
                        type="button"
                        className={appButton({ variant: "ghost", size: "sm" })}
                        disabled={busy}
                        onClick={() => {
                          const days = Number(window.prompt("Yedek bugünden itibaren kaç gün saklansın? (1–365)", "30"));
                          if (!days) return;
                          run(() => extendFinalBackupAction(b.id, days), "Saklama süresi güncellendi");
                        }}
                      >
                        <CalendarPlus aria-hidden />
                        Süreyi değiştir
                      </button>
                    ) : null}
                    {b.status === "COMPLETED" || b.status === "FAILED" ? (
                      <button
                        type="button"
                        className={appButton({ variant: "ghost", size: "sm" })}
                        disabled={busy || b.restoreStatus === "queued" || b.restoreStatus === "running"}
                        onClick={() => {
                          if (!window.confirm("Yedek arşivi Proxmox depolamasından kalıcı olarak silinsin mi?")) return;
                          run(() => adminDeleteVdsBackupAction(b.id), "Yedek silindi");
                        }}
                      >
                        <Trash2 aria-hidden />
                        Sil
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              run(() => setVdsExtraBackupSlotsAction(serviceId, Number(extra)), "Ek yedek hakkı kaydedildi");
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="vds-extra-slots">Ek yedek hakkı</Label>
              <Input id="vds-extra-slots" type="number" min={0} max={50} className="w-28" value={extra} onChange={(e) => setExtra(e.target.value)} />
            </div>
            <button type="submit" className={appButton({ variant: "outline", size: "sm" })} disabled={busy || Number(extra) === view.extra}>
              <Save aria-hidden />
              Kaydet
            </button>
          </form>
        ) : null}
      </div>

      <Dialog open={Boolean(restore)} onOpenChange={(open) => (open ? null : setRestore(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yedeği geri yükle</DialogTitle>
            <DialogDescription>
              Hedef sunucu kapatılır ve diskleri bu yedekle değiştirilir; hedefteki güncel veriler kalıcı olarak silinir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {restore?.trigger === "FINAL" ? (
              <div className="space-y-2">
                <Label htmlFor="vds-restore-target">Hedef hizmet kimliği (yeni hizmete geri yükleme için)</Label>
                <Input
                  id="vds-restore-target"
                  className="font-mono"
                  placeholder={serviceId}
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Aynı Proxmox örneğindeki aktif bir VDS olmalı. VM&apos;in adı, sahiplik işareti ve IP yapılandırması hedef hizmete göre yeniden
                  yazılır; sunucu içindeki kullanıcılar ve şifreler eski sunucununkidir.
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="vds-admin-restore-confirm">
                Onay için hedef sunucu adını yazın: <span className="font-mono">{expectedName}</span>
              </Label>
              <Input
                id="vds-admin-restore-confirm"
                className="font-mono"
                autoComplete="off"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button type="button" className={appButton({ variant: "outline" })} onClick={() => setRestore(null)} disabled={busy}>
              Vazgeç
            </button>
            <button
              type="button"
              className={appButton({ variant: "destructive" })}
              disabled={busy || confirmation.trim() !== expectedName}
              onClick={() =>
                restore &&
                run(
                  () =>
                    adminRestoreVdsBackupAction(restore.id, {
                      confirmation,
                      targetServiceId: restoreTargetId !== serviceId ? restoreTargetId : undefined,
                    }),
                  "Geri yükleme sıraya alındı",
                  () => setRestore(null)
                )
              }
            >
              {busy ? <Loader2 aria-hidden className="animate-spin" /> : <RotateCcw aria-hidden />}
              Geri yükle
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={destroyOpen} onOpenChange={setDestroyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>VM&apos;i yedeksiz sil</DialogTitle>
            <DialogDescription>
              VM son yedek alınmadan diskleriyle birlikte kalıcı olarak silinir. Müşterinin verileri geri getirilemez.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="vds-destroy-confirm">
              Onay için sunucu adını yazın: <span className="font-mono">{vmNameFor(serviceId)}</span>
            </Label>
            <Input
              id="vds-destroy-confirm"
              className="font-mono"
              autoComplete="off"
              value={destroyConfirmation}
              onChange={(e) => setDestroyConfirmation(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <button type="button" className={appButton({ variant: "outline" })} onClick={() => setDestroyOpen(false)} disabled={busy}>
              Vazgeç
            </button>
            <button
              type="button"
              className={appButton({ variant: "destructive" })}
              disabled={busy || destroyConfirmation.trim() !== vmNameFor(serviceId)}
              onClick={() =>
                run(() => terminateWithoutFinalBackupAction(serviceId, destroyConfirmation), "VM silindi", () => setDestroyOpen(false))
              }
            >
              {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Trash2 aria-hidden />}
              Yedeksiz sil
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
