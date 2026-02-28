"use client";

import { useState } from "react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  HardDrive,
  Download,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Server,
  Database,
  FileArchive,
  Trash2,
  RefreshCcw,
  Plus,
  Search,
  Settings,
  History,
  Shield,
  Cloud,
  AlertTriangle,
  Play,
} from "lucide-react";
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

const statusConfig: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof CheckCircle2;
}> = {
  COMPLETED: {
    label: "Tamamlandı",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    icon: CheckCircle2,
  },
  IN_PROGRESS: {
    label: "Devam Ediyor",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    icon: RefreshCcw,
  },
  FAILED: {
    label: "Başarısız",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    icon: AlertCircle,
  },
  SCHEDULED: {
    label: "Planlanmış",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    icon: Clock,
  },
};

const serviceIcons: Record<string, typeof HardDrive> = {
  hosting: HardDrive,
  server: Server,
  vds: Server,
  vps: Server,
  domain: Cloud,
};

const typeLabels: Record<string, string> = {
  FULL: "Tam Yedek",
  INCREMENTAL: "Artımlı",
  DATABASE: "Veritabanı",
  FILES: "Dosyalar",
};

const frequencyLabels: Record<string, string> = {
  daily: "Günlük",
  weekly: "Haftalık",
  monthly: "Aylık",
};

const filterOptions = [
  { value: "all", label: "Tümü" },
  { value: "hosting", label: "Hosting" },
  { value: "server", label: "Sunucu" },
  { value: "vds", label: "VDS" },
];

function formatSize(sizeInGB: number): string {
  if (sizeInGB === 0) return "0 B";
  if (sizeInGB < 1) return `${(sizeInGB * 1024).toFixed(0)} MB`;
  return `${sizeInGB.toFixed(1)} GB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function YedeklemeContent({ backups, schedules, stats }: YedeklemeContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"backups" | "schedules">("backups");
  const [localBackups, setLocalBackups] = useState(backups);
  const [localSchedules, setLocalSchedules] = useState(schedules);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const handleTriggerBackup = async () => {
    // Use first available service from schedules or backups
    const serviceId = schedules[0]?.serviceId || backups[0]?.serviceName;
    if (!serviceId && schedules.length === 0) {
      toast.error("Yedeklenecek hizmet bulunamadı");
      return;
    }
    setActionInProgress("trigger");
    const result = await triggerManualBackup(schedules[0]?.serviceId || "");
    if (result.success) {
      toast.success("Manuel yedekleme başlatıldı");
    } else {
      toast.error(result.error || "Yedekleme başlatılamadı");
    }
    setActionInProgress(null);
  };

  const handleDeleteBackup = async (backupId: string) => {
    setActionInProgress(backupId);
    const result = await deleteBackup(backupId);
    if (result.success) {
      setLocalBackups((prev) => prev.filter((b) => b.id !== backupId));
      toast.success("Yedek silindi");
    } else {
      toast.error(result.error || "Yedek silinemedi");
    }
    setActionInProgress(null);
  };

  const handleRestoreBackup = async (backupId: string) => {
    setActionInProgress(backupId);
    const result = await restoreBackup(backupId);
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
      setLocalBackups((prev) =>
        prev.map((b) => (b.id === backupId ? { ...b, status: "IN_PROGRESS" } : b))
      );
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
      setLocalSchedules((prev) =>
        prev.map((s) => (s.id === scheduleId ? { ...s, isActive: result.isActive! } : s))
      );
      toast.success(result.isActive ? "Zamanlama etkinleştirildi" : "Zamanlama devre dışı bırakıldı");
    } else {
      toast.error(result.error || "İşlem başarısız");
    }
    setActionInProgress(null);
  };

  const filteredBackups = localBackups.filter((backup) => {
    const matchesSearch = backup.serviceName
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === "all" || backup.serviceType === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Yedekleme</h1>
            <p className="text-muted-foreground">
              Yedeklerinizi görüntüleyin ve yönetin.
            </p>
          </div>
          <Button onClick={handleTriggerBackup} disabled={actionInProgress === "trigger"}>
            <Plus className="mr-2 h-4 w-4" />
            {actionInProgress === "trigger" ? "Başlatılıyor..." : "Manuel Yedek Al"}
          </Button>
        </div>
      </BlurFade>

      {/* Stats */}
      <BlurFade delay={0.15} inView>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <FileArchive className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Yedek</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <HardDrive className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Boyut</p>
                  <p className="text-2xl font-bold">{formatSize(stats.totalSize)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Clock className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Son Yedek</p>
                  <p className="text-lg font-bold">
                    {stats.lastBackupAt
                      ? formatDate(stats.lastBackupAt)
                      : "Yok"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <CheckCircle2 className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Başarılı</p>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Başarısız</p>
                  <p className="text-2xl font-bold">{stats.failed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </BlurFade>

      {/* Tabs */}
      <BlurFade delay={0.25} inView>
        <div className="flex gap-2 border-b pb-2">
          <Button
            variant={activeTab === "backups" ? "default" : "ghost"}
            onClick={() => setActiveTab("backups")}
            className="gap-2"
          >
            <FileArchive className="h-4 w-4" />
            Yedekler
          </Button>
          <Button
            variant={activeTab === "schedules" ? "default" : "ghost"}
            onClick={() => setActiveTab("schedules")}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            Zamanlamalar
          </Button>
        </div>
      </BlurFade>

      {/* Backups Tab */}
      {activeTab === "backups" && (
        <>
          {/* Filters */}
          <BlurFade delay={0.3} inView>
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Yedek ara..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    {filterOptions.map((option) => (
                      <Button
                        key={option.value}
                        variant={filter === option.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </BlurFade>

          {/* Backups List */}
          <BlurFade delay={0.35} inView>
            <Card>
              <CardHeader>
                <CardTitle>Son Yedekler ({filteredBackups.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredBackups.map((backup) => {
                    const status =
                      statusConfig[backup.status] ?? statusConfig.COMPLETED;
                    const StatusIcon = status.icon;
                    const ServiceIcon =
                      serviceIcons[backup.serviceType] ?? Database;

                    return (
                      <div
                        key={backup.id}
                        className="flex items-center gap-4 p-4 rounded-lg border hover:shadow-sm transition-shadow"
                      >
                        <div className={cn("p-3 rounded-lg", status.bgColor)}>
                          <ServiceIcon
                            className={cn("h-6 w-6", status.color)}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate">
                              {backup.serviceName}
                            </p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                              {typeLabels[backup.type] ?? backup.type}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(backup.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <HardDrive className="h-3 w-3" />
                              {formatSize(backup.size)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                              status.bgColor,
                              status.color
                            )}
                          >
                            <StatusIcon
                              className={cn(
                                "h-3 w-3",
                                backup.status === "IN_PROGRESS" &&
                                  "animate-spin"
                              )}
                            />
                            {status.label}
                          </div>

                          {backup.status === "COMPLETED" && (
                            <>
                              <Button
                                variant="outline"
                                size="icon"
                                title="İndir"
                                disabled={!!actionInProgress}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                title="Geri Yükle"
                                onClick={() => handleRestoreBackup(backup.id)}
                                disabled={actionInProgress === backup.id}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                title="Sil"
                                onClick={() => handleDeleteBackup(backup.id)}
                                disabled={actionInProgress === backup.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {backup.status === "FAILED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetryBackup(backup.id)}
                              disabled={actionInProgress === backup.id}
                            >
                              <RefreshCcw className="mr-2 h-4 w-4" />
                              Tekrar Dene
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {filteredBackups.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchQuery || filter !== "all"
                        ? "Aramanızla eşleşen yedek bulunamadı."
                        : "Henüz yedek bulunmuyor."}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        </>
      )}

      {/* Schedules Tab */}
      {activeTab === "schedules" && (
        <BlurFade delay={0.3} inView>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Yedekleme Zamanlamaları</CardTitle>
                  <CardDescription>
                    Otomatik yedekleme programlarınızı görüntüleyin
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {localSchedules.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Henüz yedekleme zamanlama bulunamadı.
                  </div>
                )}
                {localSchedules.map((schedule) => {
                  const ServiceIcon =
                    serviceIcons[schedule.serviceType] ?? Shield;

                  return (
                    <div
                      key={schedule.id}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-lg border",
                        !schedule.isActive && "opacity-60"
                      )}
                    >
                      <div
                        className={cn(
                          "p-3 rounded-lg",
                          schedule.isActive
                            ? "bg-green-500/10"
                            : "bg-muted"
                        )}
                      >
                        <ServiceIcon
                          className={cn(
                            "h-6 w-6",
                            schedule.isActive
                              ? "text-green-500"
                              : "text-muted-foreground"
                          )}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">
                            {schedule.serviceName}
                          </p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                            {frequencyLabels[schedule.frequency] ??
                              schedule.frequency}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Saklama: {schedule.retention} gun
                          </span>
                          <span className="flex items-center gap-1">
                            <FileArchive className="h-3 w-3" />
                            {schedule.backupCount} yedek
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>
                            Son calisma:{" "}
                            {schedule.lastRunAt
                              ? formatDate(schedule.lastRunAt)
                              : "Henüz çalışmadı"}
                          </span>
                          <span>
                            Sonraki:{" "}
                            {schedule.isActive && schedule.nextRunAt
                              ? formatDate(schedule.nextRunAt)
                              : "Devre Disi"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {schedule.isActive ? "Aktif" : "Devre Dışı"}
                          </span>
                          <Switch
                            checked={schedule.isActive}
                            onCheckedChange={() => handleToggleSchedule(schedule.id)}
                            disabled={actionInProgress === schedule.id}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </BlurFade>
      )}
    </div>
  );
}
