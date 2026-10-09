"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cloud, Database, Download, FileArchive, HardDrive, Loader2, Plus, RefreshCcw, RotateCcw, Server, Trash2 } from "lucide-react";
import {
  DataTable,
  EmptyState,
  FormField,
  IconTile,
  ListRow,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  enumLabel,
  getStatusOptions,
  type ColumnDef,
  type RowAction,
} from "@/components/app";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import {
  triggerManualBackup,
  deleteBackup,
  restoreBackup,
  retryBackup,
  toggleSchedule,
} from "@/lib/actions/customer/backups";
import { toast } from "@/lib/toast";

interface BackupItem {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceType: string;
  type: string;
  status: string;
  size: number;
  filePath: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  scheduleId: string | null;
  trigger: "MANUAL" | "SCHEDULED" | "FINAL";
  vds: boolean;
}

interface ScheduleItem {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceType: string;
  frequency: string;
  retention: number;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  backupCount: number;
}

interface BackupStats {
  total: number;
  totalSize: number;
  completed: number;
  failed: number;
  inProgress: number;
  lastBackupAt: string | null;
}

interface YedeklemeContentProps {
  backups: BackupItem[];
  schedules: ScheduleItem[];
  stats: BackupStats;
}

const serviceIcons: Record<string, typeof HardDrive> = {
  hosting: HardDrive,
  server: Server,
  vds: Server,
  vps: Server,
  domain: Cloud,
};

const serviceTypeLabels: Record<string, string> = {
  hosting: "Hosting",
  server: "Sunucu",
  vds: "VDS",
  vps: "VPS",
};

const frequencyLabels: Record<string, string> = {
  daily: "Günlük",
  weekly: "Haftalık",
  monthly: "Aylık",
};

/** Backup sizes are stored in MB (same unit as the admin panel and service detail). */
function formatSize(mb: number): string {
  if (!mb) return "—";
  if (mb >= 1024) return `${(mb / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} GB`;
  return `${mb.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} MB`;
}

function ServiceIcon({ type }: { type: string }) {
  const Icon = serviceIcons[type] ?? Database;
  return (
    <IconTile size="sm">
      <Icon />
    </IconTile>
  );
}

export function YedeklemeContent({ backups, schedules, stats }: YedeklemeContentProps) {
  const router = useRouter();
  const [localBackups, setLocalBackups] = useState(backups);
  const [localSchedules, setLocalSchedules] = useState(schedules);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Services the customer can back up manually (from schedules and existing backups).
  const serviceOptions = Array.from(
    new Map(
      [...schedules, ...backups].map((s) => [s.serviceId, { value: s.serviceId, label: s.serviceName }])
    ).values()
  );
  const [isTriggerOpen, setIsTriggerOpen] = useState(false);
  const [triggerServiceId, setTriggerServiceId] = useState(serviceOptions[0]?.value ?? "");

  const handleTriggerBackup = async () => {
    if (!triggerServiceId) {
      toast.error("Yedeklenecek hizmet bulunamadı");
      return;
    }
    setActionInProgress("trigger");
    const result = await triggerManualBackup(triggerServiceId);
    if (result.success) {
      toast.success("Manuel yedekleme başlatıldı");
      setIsTriggerOpen(false);
    } else {
      toast.error(result.error || "Yedekleme başlatılamadı");
    }
    setActionInProgress(null);
  };

  const handleDeleteBackup = async (backup: BackupItem) => {
    if (!window.confirm(`${backup.serviceName} için ${formatDateTime(backup.createdAt)} tarihli yedek kalıcı olarak silinsin mi?`)) return;
    setActionInProgress(backup.id);
    const result = await deleteBackup(backup.id);
    if (result.success) {
      setLocalBackups((prev) => prev.filter((b) => b.id !== backup.id));
      toast.success("Yedek silindi");
    } else {
      toast.error(result.error || "Yedek silinemedi");
    }
    setActionInProgress(null);
  };

  const handleRestoreBackup = async (backup: BackupItem) => {
    if (backup.vds) {
      // A server restore overwrites the whole VM: confirmed on the server page by typing its name.
      router.push(`/musteri/panel/hizmetlerim/${backup.serviceId}#yedekler`);
      return;
    }
    if (
      !window.confirm(
        `${backup.serviceName} hizmeti ${formatDateTime(backup.createdAt)} tarihli yedeğe geri döndürülecek. Bu tarihten sonraki değişiklikler kaybolabilir. Devam edilsin mi?`
      )
    )
      return;
    setActionInProgress(backup.id);
    const result = await restoreBackup(backup.id);
    if (result.success) {
      toast.success("Geri yükleme başlatıldı");
    } else {
      toast.error(result.error || "Geri yükleme başlatılamadı");
    }
    setActionInProgress(null);
  };

  const handleRetryBackup = async (backupId: string) => {
    setActionInProgress(backupId);
    const result = await retryBackup(backupId);
    if (result.success) {
      setLocalBackups((prev) => prev.map((b) => (b.id === backupId ? { ...b, status: "IN_PROGRESS" } : b)));
      toast.success("Yedekleme tekrar başlatıldı");
    } else {
      toast.error(result.error || "İşlem başarısız");
    }
    setActionInProgress(null);
  };

  const handleToggleSchedule = async (scheduleId: string) => {
    setActionInProgress(scheduleId);
    const result = await toggleSchedule(scheduleId);
    if (result.success) {
      setLocalSchedules((prev) => prev.map((s) => (s.id === scheduleId ? { ...s, isActive: result.isActive! } : s)));
      toast.success(result.isActive ? "Zamanlama etkinleştirildi" : "Zamanlama devre dışı bırakıldı");
    } else {
      toast.error(result.error || "İşlem başarısız");
    }
    setActionInProgress(null);
  };

  const rowActions = (b: BackupItem): RowAction[] => {
    const busy = actionInProgress === b.id ? "İşlem sürüyor" : undefined;
    if (b.status === "COMPLETED") {
      return [
        { label: "Geri yükle", icon: <RotateCcw aria-hidden />, onSelect: () => void handleRestoreBackup(b), disabledReason: busy },
        { label: "İndir", icon: <Download aria-hidden />, disabledReason: "Yakında" },
        { label: "Sil", icon: <Trash2 aria-hidden />, onSelect: () => void handleDeleteBackup(b), disabledReason: busy, destructive: true, separator: true },
      ];
    }
    if (b.status === "FAILED") {
      return [{ label: "Tekrar dene", icon: <RefreshCcw aria-hidden />, onSelect: () => void handleRetryBackup(b.id), disabledReason: busy }];
    }
    return [];
  };

  const PrimaryAction = ({ b }: { b: BackupItem }) => {
    const busy = actionInProgress === b.id;
    if (b.status === "COMPLETED") {
      return (
        <button
          type="button"
          className={appButton({ variant: "outline", size: "sm" })}
          onClick={() => void handleRestoreBackup(b)}
          disabled={busy}
        >
          {busy ? <Loader2 aria-hidden className="animate-spin" /> : <RotateCcw aria-hidden />}
          Geri yükle
        </button>
      );
    }
    if (b.status === "FAILED") {
      return (
        <button
          type="button"
          className={appButton({ variant: "outline", size: "sm" })}
          onClick={() => void handleRetryBackup(b.id)}
          disabled={busy}
        >
          {busy ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCcw aria-hidden />}
          Tekrar dene
        </button>
      );
    }
    return null;
  };

  const columns: ColumnDef<BackupItem>[] = [
    {
      accessorKey: "serviceName",
      header: "Hizmet",
      cell: ({ row }) => {
        const b = row.original;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <ServiceIcon type={b.serviceType} />
            <div className="min-w-0">
              <p className="truncate font-medium">{b.serviceName}</p>
              <p className="text-xs text-muted-foreground">
                {enumLabel("backupType", b.type)} yedek
                {b.trigger === "SCHEDULED" || b.scheduleId ? " · otomatik" : " · manuel"}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      id: "createdAt",
      accessorFn: (b) => b.createdAt,
      header: "Tarih",
      cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(row.original.createdAt)}</span>,
    },
    {
      accessorKey: "size",
      header: "Boyut",
      meta: { align: "right" },
      cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatSize(row.original.size)}</span>,
    },
    {
      accessorKey: "status",
      header: "Durum",
      enableSorting: false,
      cell: ({ row }) => <StatusBadge kind="backup" status={row.original.status} />,
    },
    {
      id: "primary",
      header: () => <span className="sr-only">İşlem</span>,
      enableSorting: false,
      meta: { align: "right", className: "w-px" },
      cell: ({ row }) => <PrimaryAction b={row.original} />,
    },
  ];

  const usedTypes = Array.from(new Set(localBackups.map((b) => b.serviceType)));
  const typeOptions = usedTypes.map((t) => ({ value: t, label: serviceTypeLabels[t] ?? t }));

  return (
    <>
      <PageHeader
        title="Yedekler"
        description="Hizmetlerinizin yedeklerini görüntüleyin, geri yükleyin ve otomatik yedekleme zamanlamalarını yönetin."
        actions={
          <button
            type="button"
            className={appButton()}
            onClick={() => setIsTriggerOpen(true)}
            disabled={serviceOptions.length === 0}
          >
            <Plus aria-hidden />
            Manuel yedek al
          </button>
        }
      />

      <Dialog open={isTriggerOpen} onOpenChange={setIsTriggerOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manuel yedek al</DialogTitle>
            <DialogDescription>Seçtiğiniz hizmetin tam yedeği hemen alınmaya başlar.</DialogDescription>
          </DialogHeader>
          <FormField label="Hizmet" htmlFor="backup-service">
            <Select value={triggerServiceId} onValueChange={setTriggerServiceId}>
              <SelectTrigger id="backup-service" className="h-11 md:h-9">
                <SelectValue placeholder="Hizmet seçin" />
              </SelectTrigger>
              <SelectContent>
                {serviceOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <DialogFooter className="gap-2 pt-2">
            <button
              type="button"
              className={appButton({ variant: "outline" })}
              onClick={() => setIsTriggerOpen(false)}
              disabled={actionInProgress === "trigger"}
            >
              Vazgeç
            </button>
            <button
              type="button"
              className={appButton()}
              onClick={() => void handleTriggerBackup()}
              disabled={actionInProgress === "trigger" || !triggerServiceId}
            >
              {actionInProgress === "trigger" ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {actionInProgress === "trigger" ? "Başlatılıyor…" : "Yedeği başlat"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StatGrid>
        <StatCard
          label="Toplam yedek"
          value={stats.total}
          hint={stats.inProgress ? `${stats.inProgress} yedek sürüyor` : `${stats.completed} başarılı`}
          tone={stats.inProgress ? "info" : undefined}
        />
        <StatCard label="Toplam boyut" value={formatSize(stats.totalSize)} />
        <StatCard
          label="Son yedek"
          value={stats.lastBackupAt ? formatDate(stats.lastBackupAt) : "Yok"}
          hint={stats.lastBackupAt ? `Saat ${formatDateTime(stats.lastBackupAt).split(" ").pop()}` : "Henüz yedek alınmadı"}
        />
        <StatCard
          label="Başarısız"
          value={stats.failed}
          tone={stats.failed ? "danger" : undefined}
          hint={stats.failed ? "Tekrar denemeniz gerekiyor" : "Başarısız yedek yok"}
        />
      </StatGrid>

      <DataTable
        caption="Yedekler"
        columns={columns}
        data={localBackups}
        getRowId={(b) => b.id}
        initialSort={[{ id: "createdAt", desc: true }]}
        searchFn={(b, q) => b.serviceName.toLocaleLowerCase("tr-TR").includes(q)}
        searchPlaceholder="Hizmet adına göre ara…"
        filters={[
          {
            id: "status",
            label: "Durum",
            options: getStatusOptions("backup").filter((o) => localBackups.some((b) => b.status === o.value)),
            getValue: (b) => b.status,
          },
          ...(typeOptions.length > 1
            ? [
                {
                  id: "type",
                  label: "Hizmet türü",
                  variant: "select" as const,
                  allLabel: "Tüm hizmetler",
                  options: typeOptions,
                  getValue: (b: BackupItem) => b.serviceType,
                },
              ]
            : []),
        ]}
        rowActions={rowActions}
        mobileCard={(b) => (
          <div className="space-y-3">
            <ListRow
              leading={<ServiceIcon type={b.serviceType} />}
              title={b.serviceName}
              subtitle={`${enumLabel("backupType", b.type)} yedek · ${formatDateTime(b.createdAt)}`}
              trailing={b.size ? formatSize(b.size) : undefined}
              meta={<StatusBadge kind="backup" status={b.status} />}
            />
            {b.status === "COMPLETED" || b.status === "FAILED" ? (
              <div className="pl-11">
                <PrimaryAction b={b} />
              </div>
            ) : null}
          </div>
        )}
        emptyState={
          <EmptyState
            icon={FileArchive}
            title="Henüz yedek yok"
            description="Otomatik yedekleme zamanlaması olan hizmetlerinizin yedekleri burada listelenir."
          />
        }
        noResultsText="Aramanızla eşleşen yedek bulunamadı."
      />

      <SectionCard
        title="Otomatik yedekleme"
        description="Hizmetlerinize tanımlı zamanlamaları buradan açıp kapatabilirsiniz."
        flush
      >
        {localSchedules.length === 0 ? (
          <div className="p-4 md:p-5">
            <EmptyState compact icon={RefreshCcw} title="Yedekleme zamanlaması yok" description="Hizmetlerinize tanımlı bir otomatik yedekleme zamanlaması bulunmuyor." />
          </div>
        ) : (
          <ul className="divide-y">
            {localSchedules.map((schedule) => {
              const switchId = `schedule-${schedule.id}`;
              return (
                <li key={schedule.id} className="flex items-start gap-3 px-4 py-4 md:items-center md:px-5">
                  <ServiceIcon type={schedule.serviceType} />
                  <div className={cn("min-w-0 flex-1 space-y-1", !schedule.isActive && "text-muted-foreground")}>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                      <label htmlFor={switchId} className="cursor-pointer">
                        {schedule.serviceName}
                      </label>
                      <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {frequencyLabels[schedule.frequency] ?? schedule.frequency}
                      </span>
                    </p>
                    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{schedule.retention} gün saklanır</span>
                      <span>{schedule.backupCount} yedek</span>
                      <span>Son: {schedule.lastRunAt ? formatDateTime(schedule.lastRunAt) : "henüz çalışmadı"}</span>
                      <span>
                        Sonraki: {schedule.isActive && schedule.nextRunAt ? formatDateTime(schedule.nextRunAt) : "devre dışı"}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pt-1 md:pt-0">
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {schedule.isActive ? "Açık" : "Kapalı"}
                    </span>
                    <Switch
                      id={switchId}
                      checked={schedule.isActive}
                      onCheckedChange={() => void handleToggleSchedule(schedule.id)}
                      disabled={actionInProgress === schedule.id}
                      aria-label={`${schedule.serviceName} otomatik yedekleme`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
