"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  User,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { toast } from "@/lib/toast";
import { loginAction } from "@/lib/actions/auth";

export function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/musteri/panel";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload = new FormData();
    payload.set("email", formData.email);
    payload.set("password", formData.password);
    const result = await loginAction(payload);

    if (!result?.success) {
      const errorMessage = result?.error ?? "E-posta veya şifre hatalı";
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
    } else {
      toast.success("Giriş başarılı, yönlendiriliyorsunuz.");
      router.push(callbackUrl);
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
