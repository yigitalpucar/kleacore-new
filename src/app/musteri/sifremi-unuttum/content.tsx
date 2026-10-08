"use client";

import { useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, ArrowLeft, Clock, Inbox, Loader2, MailCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/actions/auth";
import { toast } from "@/lib/toast";
import { buttonClasses } from "@/components/site";
import { AuthAlert, AuthShell, authIconClass, authInputClass } from "@/components/auth/auth-shell";
import { cn } from "@/lib/utils";

const aside = {
  label: "Hesap kurtarma",
  heading: "Şifrenizi birkaç adımda yenileyin.",
  text: "Kayıtlı e-posta adresinize tek kullanımlık bir sıfırlama bağlantısı gönderiyoruz.",
  points: [
    "Bağlantı 30 dakika geçerlidir",
    "Bağlantı yalnızca bir kez kullanılabilir",
    "Yeni şifre en az 8 karakter, büyük/küçük harf ve rakam içerir",
  ],
};

export function SifremiUnuttumContent() {
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [debugResetUrl, setDebugResetUrl] = useState<string | null>(null);

  const [state, formAction, isPending] = useActionState(
    async (
      _prev: { success: boolean; error?: string; debugResetUrl?: string } | null,
      formData: FormData
    ) => {
      const email = formData.get("email") as string;
      const result = await requestPasswordReset(formData);
      if (result.success) {
        setSubmittedEmail(email);
        setIsSuccess(true);
        setDebugResetUrl(result.debugResetUrl ?? null);
        toast.success("Şifre sıfırlama bağlantısı gönderildi.");
      } else if (result.error) {
        toast.error(result.error);
      }
      return result;
    },
    null,
  );

  const footer = (
    <p>
      Hâlâ sorun mu yaşıyorsunuz?{" "}
      <Link
        href="/musteri/destek"
        className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
      >
        Destek talebi oluşturun
      </Link>{" "}
      veya{" "}
      <Link
        href="/iletisim"
        className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
      >
        bize ulaşın
      </Link>
      .
    </p>
  );

  if (isSuccess) {
    return (
      <AuthShell
        eyebrow="E-posta gönderildi"
        title="Gelen kutunuzu kontrol edin"
        description="Şifre sıfırlama bağlantısını e-posta adresinize gönderdik."
        aside={aside}
        footer={footer}
      >
        <div className="space-y-6">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
            <span
              aria-hidden
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border bg-background"
            >
              <MailCheck className="size-5" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="text-muted-foreground">Bağlantı şu adrese gönderildi:</p>
              <p className="mt-1 truncate font-mono text-sm font-medium">{submittedEmail}</p>
            </div>
          </div>

          {debugResetUrl ? (
            <AuthAlert tone="info">
              <p className="font-medium">Geliştirme ortamı</p>
              <p className="mt-1 text-muted-foreground">
                E-posta servisi tanımlı olmadığı için test bağlantısı:
              </p>
              <a href={debugResetUrl} className="mt-1 block break-all underline underline-offset-4">
                {debugResetUrl}
              </a>
            </AuthAlert>
          ) : null}

          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2.5">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
              Bağlantı 30 dakika içinde geçerliliğini yitirir.
            </li>
            <li className="flex items-start gap-2.5">
              <Inbox className="mt-0.5 size-4 shrink-0" aria-hidden />
              E-posta gelmezse spam klasörünü kontrol edin.
            </li>
          </ul>

          <div className="grid gap-3">
            <Link href="/musteri/giris" className={buttonClasses({ className: "w-full" })}>
              <ArrowLeft className="size-4" aria-hidden />
              Giriş sayfasına dön
            </Link>
            <button
              type="button"
              className={buttonClasses({ variant: "outline", className: "w-full" })}
              onClick={() => {
                setIsSuccess(false);
                setSubmittedEmail("");
                setDebugResetUrl(null);
              }}
            >
              Farklı e-posta dene
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Şifremi unuttum"
      title="Şifrenizi sıfırlayın"
      description="Hesabınıza kayıtlı e-posta adresini girin; size bir sıfırlama bağlantısı gönderelim."
      aside={aside}
      footer={footer}
    >
      <form action={formAction} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">E-posta adresi</Label>
          <div className="relative">
            <Mail className={authIconClass} aria-hidden />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="ornek@email.com"
              className={cn(authInputClass, "pl-10")}
              required
              disabled={isPending}
            />
          </div>
        </div>

        {state && !state.success && state.error ? <AuthAlert>{state.error}</AuthAlert> : null}

        <button type="submit" className={buttonClasses({ className: "w-full" })} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Gönderiliyor…
            </>
          ) : (
            <>
              Sıfırlama bağlantısı gönder
              <ArrowRight className="size-4" aria-hidden />
            </>
          )}
        </button>

        <Link
          href="/musteri/giris"
          className={buttonClasses({ variant: "ghost", className: "w-full" })}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Giriş sayfasına dön
        </Link>
      </form>
    </AuthShell>
  );
}
