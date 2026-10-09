"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, Mail, ArrowRight, ArrowLeft, Loader2, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { toast } from "@/lib/toast";
import { loginAction } from "@/lib/actions/auth";
import { verify2FALogin } from "@/lib/actions/customer/two-factor";
import { getSafeRedirectPath } from "@/lib/utils/safe-redirect";
import { buttonClasses } from "@/components/site";
import { cn } from "@/lib/utils";
import { AuthAlert, authIconClass, authInputClass } from "./auth-shell";
import { TurnstileWidget } from "@/components/security/turnstile-widget";

export function LoginForm({
  onSwitch,
  onTwoFactorChange,
  turnstileSiteKey,
}: {
  onSwitch: () => void;
  /** Called when the 2FA challenge step is entered or left. */
  onTwoFactorChange?: (active: boolean) => void;
  /** Shown only after repeated failed attempts (server decides). */
  turnstileSiteKey: string | null;
}) {
  const searchParams = useSearchParams();
  const callbackUrl = getSafeRedirectPath(
    searchParams.get("callbackUrl"),
    "/musteri/panel"
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload = new FormData();
    payload.set("email", formData.email);
    payload.set("password", formData.password);
    if (requiresCaptcha && captchaToken) payload.set("cf-turnstile-response", captchaToken);
    const result = await loginAction(payload);

    if (result && "requiresCaptcha" in result && result.requiresCaptcha) {
      setRequiresCaptcha(true);
    }
    // A Turnstile token is single-use: fetch a fresh one for the next attempt.
    if (requiresCaptcha) setCaptchaReset((value) => value + 1);

    if (result?.requires2FA && result.challengeToken) {
      setRequires2FA(true);
      setChallengeToken(result.challengeToken);
      onTwoFactorChange?.(true);
      setLoading(false);
      return;
    }

    if (!result?.success) {
      const errorMessage = result?.error ?? "E-posta veya şifre hatalı";
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
    } else {
      toast.success("Giriş başarılı, yönlendiriliyorsunuz.");
      window.location.href = callbackUrl;
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload = new FormData();
    payload.set("challengeToken", challengeToken);
    payload.set("code", totpCode);
    if (rememberDevice) payload.set("rememberDevice", "true");
    const result = await verify2FALogin(payload);

    if (!result?.success) {
      const errorMessage = result?.error ?? "Doğrulama kodu hatalı";
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
      return;
    }

    toast.success("Giriş başarılı, yönlendiriliyorsunuz.");
    window.location.href = callbackUrl;
  };

  const handleBackToLogin = () => {
    setRequires2FA(false);
    setChallengeToken("");
    setTotpCode("");
    setError("");
    onTwoFactorChange?.(false);
  };

  if (requires2FA) {
    return (
      <form onSubmit={handleTwoFactorSubmit} className="space-y-5" aria-labelledby="twofa-title">
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
          <span
            aria-hidden
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border bg-background"
          >
            <Smartphone className="size-5" />
          </span>
          <div>
            <h2 id="twofa-title" className="text-sm font-semibold">
              İki faktörlü doğrulama
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Authenticator uygulamanızdaki 6 haneli kodu veya yedek kodunuzu girin.
            </p>
            {formData.email ? (
              <p className="mt-2 inline-flex max-w-full items-center rounded-sm border bg-background px-2 py-0.5 font-mono text-xs">
                <span className="truncate">{formData.email}</span>
              </p>
            ) : null}
          </div>
        </div>

        {error ? <AuthAlert>{error}</AuthAlert> : null}

        <div className="space-y-2">
          <Label htmlFor="totpCode">Doğrulama kodu</Label>
          <Input
            id="totpCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className={cn(authInputClass, "text-center font-mono text-lg tracking-[0.4em]")}
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            required
            autoFocus
            disabled={loading}
          />
        </div>

        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            disabled={loading}
            className="mt-0.5 size-4 shrink-0 accent-foreground"
          />
          <span>
            Bu cihazı 30 gün hatırla
            <span className="block text-xs text-muted-foreground">
              Bu tarayıcıda 30 gün boyunca doğrulama kodu istenmez; şifreniz her zaman istenir. Ortak kullanılan
              bilgisayarlarda seçmeyin.
            </span>
          </span>
        </label>

        <button
          type="submit"
          className={buttonClasses({ className: "w-full" })}
          disabled={loading || !totpCode.trim()}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-label="Doğrulanıyor" />
          ) : (
            <>
              Doğrula ve giriş yap
              <ArrowRight className="size-4" aria-hidden />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleBackToLogin}
          className={buttonClasses({ variant: "ghost", className: "w-full" })}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Giriş ekranına dön
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? <AuthAlert>{error}</AuthAlert> : null}

      <div className="space-y-2">
        <Label htmlFor="email">E-posta</Label>
        <div className="relative">
          <Mail className={authIconClass} aria-hidden />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="ornek@email.com"
            className={cn(authInputClass, "pl-10")}
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password">Şifre</Label>
          <Link
            href="/musteri/sifremi-unuttum"
            className="rounded-sm text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Şifremi unuttum
          </Link>
        </div>
        <div className="relative">
          <Lock className={authIconClass} aria-hidden />
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Şifreniz"
            className={cn(authInputClass, "pl-10")}
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            required
            disabled={loading}
          />
        </div>
      </div>

      {requiresCaptcha ? (
        <TurnstileWidget
          siteKey={turnstileSiteKey}
          action="login"
          onToken={setCaptchaToken}
          resetKey={captchaReset}
        />
      ) : null}

      <button
        type="submit"
        className={buttonClasses({ className: "w-full" })}
        disabled={loading || (requiresCaptcha && Boolean(turnstileSiteKey) && !captchaToken)}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-label="Giriş yapılıyor" />
        ) : (
          <>
            Giriş yap
            <ArrowRight className="size-4" aria-hidden />
          </>
        )}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Hesabınız yok mu?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="rounded-sm font-medium text-foreground underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Kayıt olun
        </button>
      </p>
    </form>
  );
}
