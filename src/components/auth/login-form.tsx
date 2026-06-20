"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { toast } from "@/lib/toast";
import { loginAction } from "@/lib/actions/auth";
import { verify2FALogin } from "@/lib/actions/customer/two-factor";
import { getSafeRedirectPath } from "@/lib/utils/safe-redirect";

export function LoginForm({ onSwitch }: { onSwitch: () => void }) {
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
  const [formData, setFormData] = useState({ email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload = new FormData();
    payload.set("email", formData.email);
    payload.set("password", formData.password);
    const result = await loginAction(payload);

    if (result?.requires2FA && result.challengeToken) {
      setRequires2FA(true);
      setChallengeToken(result.challengeToken);
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
  };

  if (requires2FA) {
    return (
      <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Smartphone className="h-4 w-4 text-primary" />
            İki Faktörlü Doğrulama
          </div>
          <p className="text-sm text-muted-foreground">
            Authenticator uygulamanızdaki 6 haneli kodu veya yedek kodunuzu girin.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="totpCode">Doğrulama Kodu</Label>
          <Input
            id="totpCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading || !totpCode.trim()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Doğrula ve Giriş Yap
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        <div className="text-center text-sm">
          <button
            type="button"
            onClick={handleBackToLogin}
            className="text-primary hover:underline font-medium"
          >
            Giriş ekranına dön
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">E-posta</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="ornek@email.com"
            className="pl-10"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Şifre</Label>
          <Link
            href="/musteri/sifremi-unuttum"
            className="text-xs text-primary hover:underline"
          >
            Şifremi Unuttum
          </Link>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            placeholder="********"
            className="pl-10"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            required
            disabled={loading}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Giriş Yap
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>

      <div className="text-center text-sm">
        <p className="text-muted-foreground">
          Hesabınız yok mu?{" "}
          <button
            type="button"
            onClick={onSwitch}
            className="text-primary hover:underline font-medium"
          >
            Kayıt Olun
          </button>
        </p>
      </div>
    </form>
  );
}