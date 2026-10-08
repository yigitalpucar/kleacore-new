"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, HardDrive, Loader2, Play, Power, RefreshCcw, RotateCcw, Terminal, TriangleAlert } from "lucide-react";
import {
  DetailList,
  SectionCard,
  StatusBadge,
  UnavailableAction,
  UsageMeter,
  appButton,
} from "@/components/app";
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
import { Textarea } from "@/components/ui/textarea";
import {
  refreshServerUsage,
  reinstallServer,
  restartServer,
  revealServerCredentials,
  startServer,
  stopServer,
} from "@/lib/actions/customer/servers";
import { formatDateTime } from "@/lib/format/date";
import { customerStartBlockReason } from "@/lib/services/server-power";
import { toast } from "@/lib/toast";
import type { VdsPanelView } from "@/lib/modules/server-panel";

export interface VdsPanelProps {
  serviceId: string;
  status: string;
  suspendReason: string | null;
  ipAddress: string | null;
  usage: {
    cpuUsage: number | null;
    ramUsage: number | null;
    diskUsed: number | null;
    diskLimit: number | null;
    bandwidthUsed: number | null;
  };
  view: VdsPanelView;
}

const POWER_LABELS: Record<VdsPanelView["powerState"], { label: string; tone: "success" | "muted" | "warning" | "neutral" }> = {
  running: { label: "Çalışıyor", tone: "success" },
  stopped: { label: "Kapalı", tone: "muted" },
  paused: { label: "Duraklatıldı", tone: "warning" },
  unknown: { label: "Bilinmiyor", tone: "neutral" },
};

const REINSTALL_RUNNING = ["queued", "destroy", "provision"];

function gb(n: number) {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

function memoryLabel(mb: number | null) {
  if (!mb) return null;
  return mb >= 1024 ? `${gb(mb / 1024)} GB` : `${mb} MB`;
}

/**
 * Customer VDS panel for a module-bound (Proxmox) server: identity and specs,
 * power buttons, usage, one-time initial credentials and reinstall. The
 * browser never talks to Proxmox; every action is a server action.
 */
export function VdsPanel({ serviceId, status, suspendReason, ipAddress, usage, view }: VdsPanelProps) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const [credentials, setCredentials] = useState<{ username: string | null; password: string; ipAddress: string | null } | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [reinstallOpen, setReinstallOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [sshKeys, setSshKeys] = useState("");

  const ready = view.provisioning === "ready";
  const isActive = status === "ACTIVE";
  const startBlock = customerStartBlockReason({ status, suspendReason });
  const reinstallRunning = Boolean(view.reinstall && REINSTALL_RUNNING.includes(view.reinstall.phase));
  const manageable = ready && !reinstallRunning && (isActive || startBlock === null);
  const power = POWER_LABELS[view.powerState];

  const run = (action: () => Promise<{ success: boolean; error?: string }>, success: string) =>
    startBusy(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error ?? "İşlem başarısız");
        return;
      }
      toast.success(success);
      router.refresh();
    });

  const handleStop = () => {
    if (!window.confirm("Sunucu kapatılacak (önce düzgün kapatma denenir, 60 sn sonra zorla kapatılır). Devam edilsin mi?")) return;
    run(() => stopServer(serviceId), "Sunucu durduruldu");
  };

  const handleReveal = () =>
    startBusy(async () => {
      const result = await revealServerCredentials(serviceId);
      setRevealOpen(false);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setCredentials(result.credentials);
      router.refresh();
    });

  const handleReinstall = () =>
    startBusy(async () => {
      const result = await reinstallServer(serviceId, { confirmation, sshKeys });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Yeniden kurulum başlatıldı. Birkaç dakika sürebilir.");
      setReinstallOpen(false);
      setConfirmation("");
      setSshKeys("");
      router.refresh();
    });

  const hasDiskUsage = usage.diskUsed != null && usage.diskLimit != null && usage.diskLimit > 0;
  const ip = credentials?.ipAddress ?? ipAddress;

  if (view.provisioning !== "ready") {
    return (
      <SectionCard title="Sunucu">
        <div role="status" className="flex items-start gap-3 text-sm">
          {view.provisioning === "failed" ? (
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
          ) : (
            <Loader2 aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
          )}
          <p>
            {view.provisioning === "failed"
              ? "Sunucunuzun kurulumunda bir sorun oluştu. Ekibimiz bilgilendirildi ve en kısa sürede tamamlayacak."
              : "Sunucunuz hazırlanıyor. Bu işlem genellikle birkaç dakika sürer; hazır olduğunda e-posta ile bilgilendirileceksiniz."}
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <>
      <SectionCard
        title="Sunucu"
        description={view.usageCollectedAt ? `Durum ${formatDateTime(view.usageCollectedAt)} itibarıyla` : undefined}
        actions={<StatusBadge tone={power.tone} label={reinstallRunning ? "Yeniden kuruluyor" : power.label} />}
        footer={
          view.capabilities.power ? (
            <>
              {view.capabilities.console ? null : <UnavailableAction label="Konsol" icon={<Terminal aria-hidden />} size="sm" />}
              {isActive ? (
                <>
                  <button
                    type="button"
                    className={appButton({ variant: "outline", size: "sm" })}
                    disabled={busy || !manageable}
                    onClick={() => run(() => restartServer(serviceId), "Sunucu yeniden başlatıldı")}
                  >
                    <RotateCcw aria-hidden />
                    Yeniden başlat
                  </button>
                  <button
                    type="button"
                    className={appButton({ variant: "destructive", size: "sm" })}
                    disabled={busy || !manageable}
                    onClick={handleStop}
                  >
                    <Power aria-hidden />
                    Durdur
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={appButton({ size: "sm" })}
                  disabled={busy || Boolean(startBlock) || reinstallRunning}
                  title={startBlock ?? undefined}
                  onClick={() => run(() => startServer(serviceId), "Sunucu başlatıldı")}
                >
                  {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Play aria-hidden />}
                  Başlat
                </button>
              )}
            </>
          ) : undefined
        }
      >
        <DetailList
          layout="grid"
          columns={3}
          items={[
            { label: "IP adresi", value: ip, mono: true, copy: ip ?? undefined },
            { label: "Sunucu adı", value: view.hostname, mono: true, copy: view.hostname },
            { label: "İşletim sistemi", value: view.osLabel },
            { label: "vCPU", value: view.specs.cores ? `${view.specs.cores} çekirdek` : null },
            { label: "RAM", value: memoryLabel(view.specs.memoryMB) },
            { label: "Disk", value: view.specs.diskGB ? `${view.specs.diskGB} GB` : usage.diskLimit ? `${gb(usage.diskLimit)} GB` : null },
            { label: "Kullanıcı adı", value: view.username, mono: true, copy: view.username ?? undefined },
            { label: "SSH", value: view.username && ip ? `ssh ${view.username}@${ip}` : null, mono: true, copy: view.username && ip ? `ssh ${view.username}@${ip}` : undefined },
          ]}
        />
        {!isActive && startBlock ? <p className="mt-4 text-sm text-muted-foreground">{startBlock}.</p> : null}
      </SectionCard>

      {view.capabilities.usage ? (
        <SectionCard
          title="Kaynak kullanımı"
          actions={
            <button
              type="button"
              className={appButton({ variant: "ghost", size: "sm" })}
              disabled={busy}
              onClick={() => run(() => refreshServerUsage(serviceId), "Kullanım verisi güncellendi")}
            >
              <RefreshCcw aria-hidden />
              Yenile
            </button>
          }
        >
          {usage.cpuUsage != null || usage.ramUsage != null || usage.bandwidthUsed != null ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {usage.cpuUsage != null ? <UsageMeter label="CPU" percent={usage.cpuUsage} /> : null}
              {usage.ramUsage != null ? <UsageMeter label="RAM" percent={usage.ramUsage} /> : null}
              {hasDiskUsage ? <UsageMeter label="Disk" used={usage.diskUsed} limit={usage.diskLimit} unit="GB" /> : null}
              {usage.bandwidthUsed != null ? (
                <div className="space-y-1.5">
                  <p className="text-sm">Trafik (bu ay)</p>
                  <p className="text-sm font-medium tabular-nums">{gb(usage.bandwidthUsed)} GB</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Henüz kullanım verisi yok. “Yenile” ile güncel değerleri alabilirsiniz.</p>
          )}
        </SectionCard>
      ) : null}

      {view.credentials.available || credentials ? (
        <SectionCard
          title="İlk giriş bilgileri"
          description="Kurulumda oluşturulan kullanıcı ve şifre. Güvenliğiniz için yalnızca bir kez gösterilir."
        >
          {credentials ? (
            <div className="space-y-3">
              <DetailList
                layout="grid"
                items={[
                  { label: "Kullanıcı adı", value: credentials.username, mono: true, copy: credentials.username ?? undefined },
                  { label: "Şifre", value: credentials.password, mono: true, copy: credentials.password },
                  { label: "IP adresi", value: credentials.ipAddress, mono: true, copy: credentials.ipAddress ?? undefined },
                ]}
              />
              <p role="status" className="text-sm text-muted-foreground">
                Bu şifre bu sayfadan ayrıldığınızda bir daha gösterilmez. Şimdi kaydedin ve ilk girişte <span className="font-mono">passwd</span> ile değiştirin.
              </p>
            </div>
          ) : view.credentials.revealedAt ? (
            <p className="text-sm text-muted-foreground">
              Bilgiler {formatDateTime(view.credentials.revealedAt)} tarihinde gösterildi. Şifrenizi kaybettiyseniz sunucuyu yeniden
              kurabilir veya destek talebi açabilirsiniz.
            </p>
          ) : (
            <Dialog open={revealOpen} onOpenChange={setRevealOpen}>
              <button
                type="button"
                className={appButton({ variant: "outline" })}
                disabled={busy || !manageable}
                onClick={() => setRevealOpen(true)}
              >
                <Eye aria-hidden />
                Bilgileri göster
              </button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>İlk giriş bilgileri</DialogTitle>
                  <DialogDescription>
                    Şifre yalnızca bir kez gösterilir; daha sonra panelden tekrar görüntülenemez. Ekranınızı kimsenin görmediğinden emin
                    olun ve şifreyi güvenli bir yere kaydedin.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2">
                  <button type="button" className={appButton({ variant: "outline" })} onClick={() => setRevealOpen(false)} disabled={busy}>
                    Vazgeç
                  </button>
                  <button type="button" className={appButton()} onClick={handleReveal} disabled={busy}>
                    {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Eye aria-hidden />}
                    Göster
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </SectionCard>
      ) : null}

      {view.capabilities.reinstall ? (
        <SectionCard
          title="İşletim sistemini yeniden kur"
          description="Sunucu, paketinizin şablonundan sıfırdan kurulur. IP adresi ve sunucu numarası değişmez; diskteki tüm veriler silinir."
        >
          {reinstallRunning ? (
            <p role="status" className="flex items-center gap-2 text-sm">
              <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />
              Yeniden kurulum sürüyor{view.reinstall?.requestedAt ? ` (${formatDateTime(view.reinstall.requestedAt)} tarihinde başlatıldı)` : ""}.
            </p>
          ) : (
            <div className="space-y-3">
              {view.reinstall?.phase === "failed" ? (
                <p role="alert" className="text-sm">
                  Son yeniden kurulum tamamlanamadı; ekibimiz bilgilendirildi. Destek talebi açabilirsiniz.
                </p>
              ) : null}
              <Dialog open={reinstallOpen} onOpenChange={setReinstallOpen}>
                <button
                  type="button"
                  className={appButton({ variant: "destructive" })}
                  disabled={busy || !manageable}
                  onClick={() => setReinstallOpen(true)}
                >
                  <HardDrive aria-hidden />
                  Yeniden kur
                </button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>İşletim sistemini yeniden kur</DialogTitle>
                    <DialogDescription>
                      Sunucudaki tüm dosyalar, veritabanları ve ayarlar kalıcı olarak silinir; geri alınamaz. Yeni bir ilk giriş şifresi
                      oluşturulur.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="vds-ssh-keys">SSH açık anahtarları (isteğe bağlı)</Label>
                      <Textarea
                        id="vds-ssh-keys"
                        rows={3}
                        className="font-mono text-xs"
                        placeholder="ssh-ed25519 AAAA… ad@bilgisayar"
                        value={sshKeys}
                        onChange={(event) => setSshKeys(event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Her satıra bir anahtar. Boş bırakırsanız kayıtlı anahtarlar kullanılır.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vds-reinstall-confirm">
                        Onaylamak için sunucu adını yazın: <span className="font-mono">{view.hostname}</span>
                      </Label>
                      <Input
                        id="vds-reinstall-confirm"
                        className="font-mono"
                        autoComplete="off"
                        value={confirmation}
                        onChange={(event) => setConfirmation(event.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <button type="button" className={appButton({ variant: "outline" })} onClick={() => setReinstallOpen(false)} disabled={busy}>
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      className={appButton({ variant: "destructive" })}
                      onClick={handleReinstall}
                      disabled={busy || confirmation.trim() !== view.hostname}
                    >
                      {busy ? <Loader2 aria-hidden className="animate-spin" /> : <HardDrive aria-hidden />}
                      Verileri sil ve yeniden kur
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </SectionCard>
      ) : null}
    </>
  );
}
