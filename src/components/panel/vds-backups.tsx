"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, CalendarClock, Loader2, Plus, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { EmptyState, FormField, SectionCard, StatusBadge, UsageMeter, appButton } from "@/components/app";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createVdsBackupNow,
  deleteBackup,
  restoreVdsBackup,
  saveVdsBackupScheduleAction,
} from "@/lib/actions/customer/backups";
import type { VdsBackupRowView, VdsBackupsView } from "@/lib/backups/vds";
import { formatDateTime } from "@/lib/format/date";
import { toast } from "@/lib/toast";

const TRIGGER_LABELS: Record<VdsBackupRowView["trigger"], string> = {
  MANUAL: "Manuel",
  SCHEDULED: "Otomatik",
  FINAL: "Fesih öncesi",
};

const WEEKDAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function formatSize(mb: number | null) {
  if (!mb) return "—";
  if (mb >= 1024) return `${(mb / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} GB`;
  return `${mb.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} MB`;
}

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * Customer VDS backups (Proxmox vzdump): slots, "Şimdi yedek al", restore
 * with the server name typed as confirmation, delete, automatic schedule.
 * Every action is a server action; volume ids never reach the browser.
 */
export function VdsBackups({ view }: { view: VdsBackupsView }) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const [restoreTarget, setRestoreTarget] = useState<VdsBackupRowView | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [frequency, setFrequency] = useState(view.schedule.frequency);
  const [hour, setHour] = useState(String(view.schedule.hour));
  const [weekday, setWeekday] = useState(String(view.schedule.weekday ?? 1));

  const run = (action: () => Promise<{ success: boolean; error?: string }>, success: string, after?: () => void) =>
    startBusy(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error ?? "İşlem başarısız");
        return;
      }
      toast.success(success);
      after?.();
      router.refresh();
    });

  const inFlight = view.backups.some((b) => b.status === "SCHEDULED" || b.status === "IN_PROGRESS");
  const restoring = view.backups.find((b) => b.restoreStatus === "queued" || b.restoreStatus === "running");
  const scheduleChanged =
    frequency !== view.schedule.frequency ||
    (frequency !== "off" && Number(hour) !== view.schedule.hour) ||
    (frequency === "weekly" && Number(weekday) !== (view.schedule.weekday ?? 1));

  const handleDelete = (backup: VdsBackupRowView) => {
    if (!window.confirm(`${formatDateTime(backup.createdAt)} tarihli yedek kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return;
    run(() => deleteBackup(backup.id), "Yedek silindi");
  };

  const handleRestore = () => {
    if (!restoreTarget) return;
    run(() => restoreVdsBackup(restoreTarget.id, confirmation), "Geri yükleme başlatıldı. Sunucunuz birkaç dakika kapalı kalacak.", () => {
      setRestoreTarget(null);
      setConfirmation("");
    });
  };

  if (view.quota <= 0 && view.backups.length === 0) {
    return (
      <SectionCard id="yedekler" title="Yedekler">
        <EmptyState
          compact
          icon={Archive}
          title="Paketinizde yedekleme yok"
          description="Sunucu yedeği için paketinizi yükseltebilir veya ek yedek hakkı için destek talebi açabilirsiniz."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      id="yedekler"
      title="Yedekler"
      description={`Sunucunuzun tam yedekleri. En fazla ${view.quota} yedek saklanır; otomatik yedekte hak dolarsa en eski yedek silinir.`}
      actions={
        <button
          type="button"
          className={appButton({ size: "sm" })}
          disabled={busy || !view.canCreate}
          title={view.blockedReason ?? undefined}
          onClick={() => run(() => createVdsBackupNow(view.serviceId), "Yedek sıraya alındı. Tamamlandığında burada görünecek.")}
        >
          {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Plus aria-hidden />}
          Şimdi yedek al
        </button>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <UsageMeter label="Yedek hakkı" used={view.used} limit={view.quota} />
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">Toplam boyut</p>
            <p className="font-medium tabular-nums">{formatSize(view.usedMB)}</p>
          </div>
        </div>

        {view.blockedReason && !inFlight && !restoring ? <p className="text-sm text-muted-foreground">{view.blockedReason}</p> : null}
        {inFlight ? (
          <p role="status" className="flex items-center gap-2 text-sm">
            <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />
            Yedek alınıyor. Sunucunuz bu sırada çalışmaya devam eder.
          </p>
        ) : null}
        {restoring ? (
          <p role="status" className="flex items-center gap-2 text-sm">
            <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />
            {formatDateTime(restoring.createdAt)} tarihli yedek geri yükleniyor. Sunucunuz işlem bitene kadar kapalı.
          </p>
        ) : null}

        {view.backups.length === 0 ? (
          <EmptyState compact icon={Archive} title="Henüz yedek yok" description="İlk yedeğinizi şimdi alabilir veya otomatik yedeklemeyi açabilirsiniz." />
        ) : (
          <ul className="divide-y rounded-md border">
            {view.backups.map((backup) => (
              <li key={backup.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium tabular-nums">{formatDateTime(backup.completedAt ?? backup.createdAt)}</p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{TRIGGER_LABELS[backup.trigger]}</span>
                    <span className="tabular-nums">{formatSize(backup.sizeMB)}</span>
                    {backup.restoreStatus === "done" ? <span>Geri yüklendi</span> : null}
                    {backup.restoreError ? <span className="text-red-600">{backup.restoreError}</span> : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <StatusBadge kind="backup" status={backup.status} />
                  {backup.status === "COMPLETED" ? (
                    <button
                      type="button"
                      className={appButton({ variant: "outline", size: "sm" })}
                      disabled={busy || Boolean(restoring) || inFlight || !view.active}
                      onClick={() => {
                        setConfirmation("");
                        setRestoreTarget(backup);
                      }}
                    >
                      <RotateCcw aria-hidden />
                      Geri yükle
                    </button>
                  ) : null}
                  {backup.status === "COMPLETED" || backup.status === "FAILED" ? (
                    <button
                      type="button"
                      className={appButton({ variant: "ghost", size: "sm" })}
                      disabled={busy || backup.restoreStatus === "queued" || backup.restoreStatus === "running"}
                      onClick={() => handleDelete(backup)}
                      aria-label={`${formatDateTime(backup.createdAt)} tarihli yedeği sil`}
                    >
                      <Trash2 aria-hidden />
                      Sil
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {view.quota > 0 ? (
          <div className="space-y-3 rounded-md border p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CalendarClock aria-hidden className="size-4 text-muted-foreground" />
              Otomatik yedekleme
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Sıklık" htmlFor="vds-backup-frequency">
                <Select value={frequency} onValueChange={(value) => setFrequency(value as typeof frequency)}>
                  <SelectTrigger id="vds-backup-frequency" className="h-11 md:h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Kapalı</SelectItem>
                    <SelectItem value="daily">Her gün</SelectItem>
                    <SelectItem value="weekly">Haftada bir</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              {frequency === "weekly" ? (
                <FormField label="Gün" htmlFor="vds-backup-weekday">
                  <Select value={weekday} onValueChange={setWeekday}>
                    <SelectTrigger id="vds-backup-weekday" className="h-11 md:h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((label, index) => (
                        <SelectItem key={label} value={String(index)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              ) : null}
              {frequency !== "off" ? (
                <FormField label="Saat (Türkiye saati)" htmlFor="vds-backup-hour">
                  <Select value={hour} onValueChange={setHour}>
                    <SelectTrigger id="vds-backup-hour" className="h-11 md:h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, h) => (
                        <SelectItem key={h} value={String(h)}>
                          {hourLabel(h)}–{hourLabel((h + 1) % 24)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {view.schedule.nextRunAt
                  ? `Sonraki otomatik yedek: ${formatDateTime(view.schedule.nextRunAt)} (seçilen saat aralığında başlar).`
                  : "Otomatik yedekleme kapalı."}
              </p>
              <button
                type="button"
                className={appButton({ variant: "outline", size: "sm" })}
                disabled={busy || !scheduleChanged}
                onClick={() =>
                  run(
                    () =>
                      saveVdsBackupScheduleAction(view.serviceId, {
                        frequency,
                        hour: Number(hour),
                        weekday: frequency === "weekly" ? Number(weekday) : null,
                      }),
                    frequency === "off" ? "Otomatik yedekleme kapatıldı" : "Otomatik yedekleme kaydedildi"
                  )
                }
              >
                Kaydet
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(restoreTarget)} onOpenChange={(open) => (open ? null : setRestoreTarget(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yedeği geri yükle</DialogTitle>
            <DialogDescription>
              Sunucunuz kapatılır ve diskleri {restoreTarget ? formatDateTime(restoreTarget.completedAt ?? restoreTarget.createdAt) : ""}{" "}
              tarihli yedekle değiştirilir. Bu tarihten sonra yazılan tüm dosyalar, veritabanları ve ayarlar kalıcı olarak silinir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p role="alert" className="flex items-start gap-2 rounded-md border border-dashed border-amber-500/60 p-3 text-sm">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
              Geri alınamaz. Güncel verileri korumak istiyorsanız önce yeni bir yedek alın.
            </p>
            <div className="space-y-2">
              <Label htmlFor="vds-restore-confirm">
                Onaylamak için sunucu adını yazın: <span className="font-mono">{view.hostname}</span>
              </Label>
              <Input
                id="vds-restore-confirm"
                className="font-mono"
                autoComplete="off"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button type="button" className={appButton({ variant: "outline" })} onClick={() => setRestoreTarget(null)} disabled={busy}>
              Vazgeç
            </button>
            <button
              type="button"
              className={appButton({ variant: "destructive" })}
              onClick={handleRestore}
              disabled={busy || confirmation.trim() !== view.hostname}
            >
              {busy ? <Loader2 aria-hidden className="animate-spin" /> : <RotateCcw aria-hidden />}
              Verileri sil ve geri yükle
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
