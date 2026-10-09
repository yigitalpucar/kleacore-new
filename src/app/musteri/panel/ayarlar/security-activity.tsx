"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, MonitorSmartphone, Trash2 } from "lucide-react";
import { EmptyState, FormSection, StatusBadge, appButton } from "@/components/app";
import { removeTrustedDeviceAction, signOutOtherSessionsAction } from "@/lib/actions/customer/security";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { toast } from "@/lib/toast";

export interface SecurityLoginRow {
  id: string;
  createdAt: string;
  success: boolean;
  reason: string | null;
  method: string | null;
  twoFactorUsed: boolean;
  device: string;
  ipAddress: string | null;
  network: string | null;
  newDevice: boolean;
}

export interface SecuritySessionRow {
  id: string;
  createdAt: string;
  device: string;
  ipAddress: string | null;
  network: string | null;
  current: boolean;
}

export interface SecurityDeviceRow {
  id: string;
  label: string;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
}

export interface SecurityOverviewData {
  recentLogins: SecurityLoginRow[];
  sessions: SecuritySessionRow[];
  devices: SecurityDeviceRow[];
}

const sectionCls = "lg:grid-cols-1 lg:gap-4";

const METHOD_LABELS: Record<string, string> = {
  password: "Şifre",
  two_factor: "Şifre + doğrulama kodu",
  trusted_device: "Şifre + hatırlanan cihaz",
  reissue: "Oturum yenilendi",
};

const FAILURE_LABELS: Record<string, string> = {
  bad_password: "Hatalı şifre",
  bad_2fa: "Hatalı doğrulama kodu",
  inactive: "Hesap aktif değil",
  "2fa_required": "Doğrulama kodu girilmedi",
};

function where(row: { ipAddress: string | null; network: string | null }) {
  return [row.ipAddress, row.network && row.network !== row.ipAddress ? row.network : null].filter(Boolean).join(" · ");
}

export function SecurityActivity({ data }: { data: SecurityOverviewData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function signOutOthers() {
    if (!window.confirm("Bu cihaz dışındaki tüm oturumlar kapatılsın ve hatırlanan cihazlar kaldırılsın mı?")) return;
    setBusy("sessions");
    const result = await signOutOtherSessionsAction();
    setBusy(null);
    if (!result.success) {
      toast.error("Oturumlar kapatılamadı");
      return;
    }
    if ("signedOut" in result && result.signedOut) {
      // Full reload after a session change (see CLAUDE.md).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/musteri/giris";
      return;
    }
    toast.success("Diğer oturumlar en geç 5 dakika içinde kapanacak.");
    router.refresh();
  }

  async function removeDevice(id: string) {
    setBusy(id);
    const result = await removeTrustedDeviceAction(id);
    setBusy(null);
    if (!result.success) {
      toast.error(result.error ?? "Cihaz kaldırılamadı");
      return;
    }
    toast.success("Cihaz kaldırıldı; bir sonraki girişte doğrulama kodu istenecek.");
    router.refresh();
  }

  return (
    <>
      <FormSection
        className={sectionCls}
        title="Aktif oturumlar"
        description="Son 30 günde açılan ve hâlâ geçerli olabilecek oturumlar. Tanımadığınız bir oturum varsa şifrenizi değiştirin."
        footer={
          <button type="button" className={appButton({ variant: "outline" })} onClick={signOutOthers} disabled={busy !== null}>
            <LogOut aria-hidden />
            {busy === "sessions" ? "Kapatılıyor…" : "Diğer tüm oturumları kapat"}
          </button>
        }
      >
        {data.sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Kayıtlı oturum bilgisi yok.</p>
        ) : (
          <ul className="divide-y divide-dashed rounded-md border">
            {data.sessions.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{session.device}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(session.createdAt)}
                    {where(session) ? ` · ${where(session)}` : null}
                  </p>
                </div>
                {session.current ? <StatusBadge tone="success" label="Bu cihaz" /> : null}
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      <FormSection
        className={sectionCls}
        title="Hatırlanan cihazlar"
        description="Girişte “Bu cihazı 30 gün hatırla” seçtiğiniz cihazlarda doğrulama kodu istenmez. Şifre değişikliğinde veya iki faktörlü doğrulama kapatıldığında hepsi kaldırılır."
      >
        {data.devices.length === 0 ? (
          <EmptyState compact icon={MonitorSmartphone} title="Hatırlanan cihaz yok" />
        ) : (
          <ul className="divide-y divide-dashed rounded-md border">
            {data.devices.map((device) => (
              <li key={device.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{device.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Eklendi {formatDate(device.createdAt)}
                    {device.lastUsedAt ? ` · Son kullanım ${formatDateTime(device.lastUsedAt)}` : null} · Bitiş{" "}
                    {formatDate(device.expiresAt)}
                    {device.ipAddress ? ` · ${device.ipAddress}` : null}
                  </p>
                </div>
                <button
                  type="button"
                  className={appButton({ variant: "ghost", size: "sm" })}
                  onClick={() => removeDevice(device.id)}
                  disabled={busy !== null}
                >
                  <Trash2 aria-hidden />
                  {busy === device.id ? "Kaldırılıyor…" : "Kaldır"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      <FormSection
        className={sectionCls}
        title="Son giriş denemeleri"
        description="Yeni bir cihazdan giriş yapıldığında ve art arda hatalı denemelerde e-posta ile bilgilendirilirsiniz."
      >
        {data.recentLogins.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>
        ) : (
          <ul className="divide-y divide-dashed rounded-md border">
            {data.recentLogins.map((login) => (
              <li key={login.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {login.device}
                    {login.newDevice ? <span className="ml-2 text-xs font-normal text-muted-foreground">(yeni cihaz)</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(login.createdAt)}
                    {where(login) ? ` · ${where(login)}` : null}
                    {login.success && login.method ? ` · ${METHOD_LABELS[login.method] ?? login.method}` : null}
                    {!login.success && login.reason ? ` · ${FAILURE_LABELS[login.reason] ?? login.reason}` : null}
                  </p>
                </div>
                <StatusBadge tone={login.success ? "success" : "danger"} label={login.success ? "Başarılı" : "Başarısız"} />
              </li>
            ))}
          </ul>
        )}
      </FormSection>
    </>
  );
}
