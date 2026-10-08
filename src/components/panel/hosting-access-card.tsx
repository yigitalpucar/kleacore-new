"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Database, Eye, EyeOff, FolderOpen, KeyRound, Loader2, LogIn, Mail, RefreshCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CopyButton, DetailList, SectionCard, UnavailableAction, appButton } from "@/components/app";
import {
  openHostingPanel,
  resetHostingPanelPassword,
  revealHostingPanelPassword,
} from "@/lib/actions/customer/hosting-panel";
import { formatDateTime } from "@/lib/format/date";
import { toast } from "@/lib/toast";
import type { PanelLink } from "@/lib/services/panel-access";
import { usePanelLauncher } from "./use-panel-launcher";

export interface HostingAccessData {
  serviceId: string;
  status: string;
  username: string | null;
  /** The service is bound to a module that supports single sign-on / password reset. */
  sso: boolean;
  passwordReset: boolean;
  hasStoredPassword: boolean;
  passwordSetAt: string | null;
}

const QUICK_LINKS: { link: PanelLink; label: string; description: string; icon: React.ReactNode }[] = [
  { link: "fileManager", label: "Dosya Yöneticisi", description: "cPanel dosya işlemleri", icon: <FolderOpen aria-hidden /> },
  { link: "emailAccounts", label: "E-posta hesapları", description: "cPanel e-posta yönetimi", icon: <Mail aria-hidden /> },
  { link: "phpMyAdmin", label: "phpMyAdmin", description: "Veritabanı yönetimi", icon: <Database aria-hidden /> },
];

const tileClass =
  "flex min-h-[60px] w-full items-center gap-3 rounded-md border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

/**
 * Customer hosting detail → "cPanel erişimi": one-click cPanel / Webmail
 * login (fresh one-time URL per click), quick links into cPanel apps, the
 * panel username and the stored password behind a confirmation, and
 * "Şifreyi sıfırla".
 */
export function HostingAccessCard({ data }: { data: HostingAccessData }) {
  const router = useRouter();
  const { launch, pending } = usePanelLauncher();
  const [revealOpen, setRevealOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState<string | null>(null);

  const active = data.status === "ACTIVE";
  const ssoReason = !data.sso
    ? "Panel girişi hizmetiniz otomasyona bağlandığında açılır"
    : !active
      ? "Hizmet aktif değil"
      : null;

  const open = (link: PanelLink) => launch(link, () => openHostingPanel(data.serviceId, link));

  async function reveal() {
    setBusy(true);
    const result = await revealHostingPanelPassword(data.serviceId);
    setBusy(false);
    setRevealOpen(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setPassword(result.password);
  }

  async function reset() {
    setBusy(true);
    const result = await resetHostingPanelPassword(data.serviceId);
    setBusy(false);
    setResetOpen(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setPassword(result.password);
    toast.success("cPanel şifreniz yenilendi. Yeni şifre aşağıda gösteriliyor.");
    router.refresh();
  }

  const passwordValue = password ? (
    <span className="flex items-center gap-1">
      <span className="break-all font-mono text-[13px]">{password}</span>
      <CopyButton value={password} label="Şifreyi kopyala" />
      <button
        type="button"
        onClick={() => setPassword(null)}
        aria-label="Şifreyi gizle"
        title="Gizle"
        className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:size-8"
      >
        <EyeOff aria-hidden className="size-4" />
      </button>
    </span>
  ) : data.hasStoredPassword ? (
    <span className="flex items-center gap-2">
      <span aria-label="Gizli" className="font-mono tracking-widest">
        ••••••••
      </span>
      <button
        type="button"
        onClick={() => setRevealOpen(true)}
        className={appButton({ variant: "ghost", size: "sm" })}
      >
        <Eye aria-hidden />
        Göster
      </button>
    </span>
  ) : (
    <span className="text-muted-foreground">Kayıtlı değil</span>
  );

  return (
    <SectionCard
      title="cPanel erişimi"
      description="Her tıklamada yalnızca birkaç saniye geçerli, tek kullanımlık bir giriş bağlantısı oluşturulur."
      actions={
        ssoReason ? (
          <>
            <UnavailableAction label="cPanel'e giriş" icon={<LogIn aria-hidden />} reason={ssoReason} size="sm" variant="primary" />
            <UnavailableAction label="Webmail" icon={<Mail aria-hidden />} reason={ssoReason} size="sm" />
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void open("panel")}
              disabled={pending !== null}
              className={appButton({ size: "sm" })}
            >
              {pending === "panel" ? <Loader2 aria-hidden className="animate-spin" /> : <LogIn aria-hidden />}
              cPanel&apos;e giriş
            </button>
            <button
              type="button"
              onClick={() => void open("webmail")}
              disabled={pending !== null}
              className={appButton({ variant: "outline", size: "sm" })}
            >
              {pending === "webmail" ? <Loader2 aria-hidden className="animate-spin" /> : <Mail aria-hidden />}
              Webmail
            </button>
          </>
        )
      }
    >
      <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-3">
          {QUICK_LINKS.map((item) =>
            ssoReason ? (
              <UnavailableAction
                key={item.link}
                layout="tile"
                label={item.label}
                description={item.description}
                icon={item.icon}
                reason={data.sso ? "Pasif" : "Kapalı"}
              />
            ) : (
              <button
                key={item.link}
                type="button"
                onClick={() => void open(item.link)}
                disabled={pending !== null}
                className={tileClass}
              >
                {pending === item.link ? <Loader2 aria-hidden className="animate-spin" /> : item.icon}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                </span>
              </button>
            )
          )}
        </div>

        <div className="border-t pt-4">
          <DetailList
            items={[
              { label: "cPanel kullanıcı adı", value: data.username, mono: true, copy: data.username ?? undefined },
              { label: "Şifre", value: passwordValue },
              {
                label: "Şifre değişikliği",
                value: data.passwordSetAt ? formatDateTime(data.passwordSetAt) : null,
              },
            ]}
          />
          {data.passwordReset ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setResetOpen(true)}
                disabled={!active}
                className={appButton({ variant: "outline", size: "sm" })}
              >
                <RefreshCcw aria-hidden />
                Şifreyi sıfırla
              </button>
              <p className="text-xs text-muted-foreground">
                cPanel içinden şifrenizi değiştirdiyseniz burada görünen şifre güncel olmayabilir.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={revealOpen} onOpenChange={setRevealOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Şifre gösterilsin mi?</DialogTitle>
            <DialogDescription>
              cPanel şifreniz ekranda açıkça görünecek. Çevrenizde ekranınızı görebilecek kimse olmadığından emin olun. Bu
              işlem hesabınızın güvenlik kayıtlarına yazılır.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button type="button" className={appButton({ variant: "outline" })} onClick={() => setRevealOpen(false)} disabled={busy}>
              Vazgeç
            </button>
            <button type="button" className={appButton()} onClick={() => void reveal()} disabled={busy}>
              {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Eye aria-hidden />}
              Şifreyi göster
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>cPanel şifresi sıfırlansın mı?</DialogTitle>
            <DialogDescription>
              Yeni ve güçlü bir şifre oluşturulup cPanel hesabınıza uygulanır; eski şifre hemen geçersiz olur. FTP ve e-posta
              hesaplarınızın şifreleri değişmez.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button type="button" className={appButton({ variant: "outline" })} onClick={() => setResetOpen(false)} disabled={busy}>
              Vazgeç
            </button>
            <button type="button" className={appButton({ variant: "destructive" })} onClick={() => void reset()} disabled={busy}>
              {busy ? <Loader2 aria-hidden className="animate-spin" /> : <KeyRound aria-hidden />}
              Şifreyi sıfırla
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
