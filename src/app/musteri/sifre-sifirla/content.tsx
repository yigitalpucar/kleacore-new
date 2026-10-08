"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleCheck, Loader2, Lock, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "@/lib/actions/auth";
import { toast } from "@/lib/toast";
import { buttonClasses } from "@/components/site";
import { AuthAlert, AuthShell, authIconClass, authInputClass } from "@/components/auth/auth-shell";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { cn } from "@/lib/utils";

interface SifreSifirlaContentProps {
  token?: string;
}

const aside = {
  label: "Hesap kurtarma",
  heading: "Güçlü bir şifre seçin.",
  text: "Yeni şifreniz kaydedildikten sonra sıfırlama bağlantısı geçersiz olur.",
  points: [
    "En az 8 karakter",
    "Büyük harf, küçük harf ve rakam",
    "Başka sitelerde kullanmadığınız bir şifre",
  ],
};

function StatusBlock({
  icon: Icon,
  children,
}: {
  icon: typeof CircleCheck;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
      <span
        aria-hidden
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border bg-background"
      >
        <Icon className="size-5" />
      </span>
      <p className="pt-2 text-muted-foreground">{children}</p>
    </div>
  );
}

export function SifreSifirlaContent({ token }: SifreSifirlaContentProps) {
  const [password, setPassword] = useState("");
  const [state, formAction, isPending] = useActionState(
    async (_prev: { success: boolean; error?: string } | null, formData: FormData) => {
      const result = await resetPasswordAction(formData);
      if (result.success) {
        toast.success("Şifreniz başarıyla güncellendi.");
      } else if (result.error) {
        toast.error(result.error);
      }
      return result;
    },
    null
  );

  const isSuccess = !!state?.success;

  if (!token) {
    return (
      <AuthShell
        eyebrow="Bağlantı geçersiz"
        title="Bu bağlantı kullanılamıyor"
        description="Şifre sıfırlama bağlantısı eksik veya hatalı. Yeni bir bağlantı isteyebilirsiniz."
        aside={aside}
      >
        <div className="space-y-6">
          <StatusBlock icon={TriangleAlert}>Şifre sıfırlama bağlantısı geçersiz.</StatusBlock>
          <Link href="/musteri/sifremi-unuttum" className={buttonClasses({ className: "w-full" })}>
            <ArrowLeft className="size-4" aria-hidden />
            Yeni bağlantı iste
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (isSuccess) {
    return (
      <AuthShell
        eyebrow="Şifre güncellendi"
        title="Şifreniz değiştirildi"
        description="Yeni şifrenizle giriş yapabilirsiniz."
        aside={aside}
      >
        <div className="space-y-6">
          <StatusBlock icon={CircleCheck}>Şifreniz başarıyla güncellendi.</StatusBlock>
          <Link href="/musteri/giris" className={buttonClasses({ className: "w-full" })}>
            Giriş yap
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Şifre sıfırlama"
      title="Yeni şifre belirleyin"
      description="Hesabınız için yeni bir şifre girin."
      aside={aside}
    >
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="token" value={token} />

        <div className="space-y-2">
          <Label htmlFor="password">Yeni şifre</Label>
          <div className="relative">
            <Lock className={authIconClass} aria-hidden />
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              className={cn(authInputClass, "pl-10")}
              placeholder="En az 8 karakter"
              aria-describedby="new-password-rules"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isPending}
            />
          </div>
          <PasswordRequirements id="new-password-rules" value={password} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Yeni şifre (tekrar)</Label>
          <div className="relative">
            <Lock className={authIconClass} aria-hidden />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              className={cn(authInputClass, "pl-10")}
              placeholder="Yeni şifrenizi tekrar girin"
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
              Güncelleniyor…
            </>
          ) : (
            "Şifreyi güncelle"
          )}
        </button>

        <Link href="/musteri/giris" className={buttonClasses({ variant: "ghost", className: "w-full" })}>
          <ArrowLeft className="size-4" aria-hidden />
          Giriş sayfasına dön
        </Link>
      </form>
    </AuthShell>
  );
}
