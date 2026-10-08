"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, Mail, ArrowRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { loginAction, registerAction } from "@/lib/actions/auth";
import { buttonClasses } from "@/components/site";
import { cn } from "@/lib/utils";
import { AuthAlert, authIconClass, authInputClass } from "./auth-shell";
import { PasswordRequirements, passwordMeetsRules } from "./password-requirements";

export function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Şifreler eşleşmiyor");
      toast.error("Şifreler eşleşmiyor");
      return;
    }

    // Same rules as passwordSchema (server validates again).
    if (!passwordMeetsRules(formData.password)) {
      setError("Şifre en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermeli");
      toast.error("Şifre gereksinimleri karşılanmıyor");
      return;
    }

    setLoading(true);

    const registerPayload = new FormData();
    registerPayload.set("name", formData.name);
    registerPayload.set("surname", formData.surname);
    registerPayload.set("email", formData.email);
    registerPayload.set("password", formData.password);
    registerPayload.set("confirmPassword", formData.confirmPassword);
    const registerResult = await registerAction(registerPayload);

    if (!registerResult.success) {
      const errorMessage = registerResult.error || "Kayıt başarısız";
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
      return;
    }

    const loginPayload = new FormData();
    loginPayload.set("email", formData.email);
    loginPayload.set("password", formData.password);
    const result = await loginAction(loginPayload);

    if (!result?.success) {
      setError("Kayıt başarılı, ancak otomatik giriş yapılamadı. Lütfen giriş yapın.");
      toast.info("Kayıt başarılı. Otomatik giriş yapılamadı, lütfen giriş yapın.");
      setLoading(false);
    } else {
      toast.success("Kayıt başarılı, hoş geldiniz.");
      router.push("/musteri/panel");
      router.refresh();
    }
  };

  const confirmMismatch =
    formData.confirmPassword.length > 0 && formData.confirmPassword !== formData.password;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? <AuthAlert>{error}</AuthAlert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Ad</Label>
          <div className="relative">
            <User className={authIconClass} aria-hidden />
            <Input
              id="name"
              autoComplete="given-name"
              placeholder="Adınız"
              className={cn(authInputClass, "pl-10")}
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              disabled={loading}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="surname">Soyad</Label>
          <Input
            id="surname"
            autoComplete="family-name"
            placeholder="Soyadınız"
            className={authInputClass}
            value={formData.surname}
            onChange={(e) =>
              setFormData({ ...formData, surname: e.target.value })
            }
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-email">E-posta</Label>
        <div className="relative">
          <Mail className={authIconClass} aria-hidden />
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder="ornek@email.com"
            className={cn(authInputClass, "pl-10")}
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-password">Şifre</Label>
        <div className="relative">
          <Lock className={authIconClass} aria-hidden />
          <Input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            placeholder="En az 8 karakter"
            aria-describedby="reg-password-rules"
            className={cn(authInputClass, "pl-10")}
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            required
            disabled={loading}
          />
        </div>
        <PasswordRequirements id="reg-password-rules" value={formData.password} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Şifre tekrar</Label>
        <div className="relative">
          <Lock className={authIconClass} aria-hidden />
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Şifrenizi tekrar girin"
            aria-invalid={confirmMismatch || undefined}
            aria-describedby={confirmMismatch ? "confirm-hint" : undefined}
            className={cn(authInputClass, "pl-10")}
            value={formData.confirmPassword}
            onChange={(e) =>
              setFormData({
                ...formData,
                confirmPassword: e.target.value,
              })
            }
            required
            disabled={loading}
          />
        </div>
        {confirmMismatch ? (
          <p id="confirm-hint" className="text-xs text-destructive dark:text-red-300">
            Şifreler eşleşmiyor.
          </p>
        ) : null}
      </div>

      <button type="submit" className={buttonClasses({ className: "w-full" })} disabled={loading}>
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-label="Hesap oluşturuluyor" />
        ) : (
          <>
            Hesap oluştur
            <ArrowRight className="size-4" aria-hidden />
          </>
        )}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Zaten hesabınız var mı?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="rounded-sm font-medium text-foreground underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Giriş yapın
        </button>
      </p>
    </form>
  );
}
