"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, Mail, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { loginAction, registerAction } from "@/lib/actions/auth";

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

    if (formData.password.length < 6) {
      setError("Şifre en az 6 karakter olmalı");
      toast.error("Şifre en az 6 karakter olmalı");
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Ad</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="name"
              placeholder="Adınız"
              className="pl-10"
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
            placeholder="Soyadınız"
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
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="reg-email"
            type="email"
            placeholder="ornek@email.com"
            className="pl-10"
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
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="reg-password"
            type="password"
            placeholder="En az 6 karakter"
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

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="confirmPassword"
            type="password"
            placeholder="********"
            className="pl-10"
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
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Hesap Oluştur
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>

      <div className="text-center text-sm">
        <p className="text-muted-foreground">
          Zaten hesabınız var mı?{" "}
          <button
            type="button"
            onClick={onSwitch}
            className="text-primary hover:underline font-medium"
          >
            Giriş Yapın
          </button>
        </p>
      </div>
    </form>
  );
}
