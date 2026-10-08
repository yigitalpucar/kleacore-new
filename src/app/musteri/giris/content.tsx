"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { cn } from "@/lib/utils";

export type AuthMode = "login" | "register";

const copy: Record<AuthMode, { eyebrow: string; title: string; description: string }> = {
  login: {
    eyebrow: "Müşteri girişi",
    title: "Hesabınıza giriş yapın",
    description: "Hizmetlerinizi, faturalarınızı ve destek taleplerinizi yönetmek için giriş yapın.",
  },
  register: {
    eyebrow: "Yeni hesap",
    title: "Hesap oluşturun",
    description: "Birkaç bilgiyle hesabınızı açın; siparişlerinizi ve hizmetlerinizi tek panelden takip edin.",
  },
};

const twoFactorCopy = {
  eyebrow: "Güvenlik doğrulaması",
  title: "Girişi doğrulayın",
  description: "Hesabınızda iki faktörlü doğrulama açık. Devam etmek için kodu girin.",
};

export function GirisContent({ initialMode }: { initialMode: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [twoFactor, setTwoFactor] = useState(false);

  const switchTo = (next: AuthMode) => {
    setMode(next);
    // Keep the URL shareable (?mod=kayit) without a navigation.
    try {
      const url = new URL(window.location.href);
      if (next === "register") url.searchParams.set("mod", "kayit");
      else url.searchParams.delete("mod");
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* ignore */
    }
  };

  const text = twoFactor ? twoFactorCopy : copy[mode];

  return (
    <AuthShell
      eyebrow={text.eyebrow}
      title={text.title}
      description={text.description}
      footer={
        <p>
          Giriş yapamıyor musunuz?{" "}
          <Link
            href="/iletisim"
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            Bize ulaşın
          </Link>
          .
        </p>
      }
    >
      {!twoFactor ? (
        <div
          role="tablist"
          aria-label="Giriş veya kayıt"
          className="mb-6 grid grid-cols-2 gap-1 rounded-lg border bg-muted/50 p-1"
        >
          {(["login", "register"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={mode === key}
              aria-controls="auth-panel"
              onClick={() => switchTo(key)}
              className={cn(
                "h-10 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {key === "login" ? "Giriş yap" : "Kayıt ol"}
            </button>
          ))}
        </div>
      ) : null}

      <div id="auth-panel" role="tabpanel" aria-labelledby={`tab-${mode}`}>
        <Suspense
          fallback={<div className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</div>}
        >
          {mode === "login" ? (
            <LoginForm onSwitch={() => switchTo("register")} onTwoFactorChange={setTwoFactor} />
          ) : (
            <RegisterForm onSwitch={() => switchTo("login")} />
          )}
        </Suspense>
      </div>
    </AuthShell>
  );
}
