"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle, KeyRound, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BlurFade } from "@/components/magicui/blur-fade";
import { resetPasswordAction } from "@/lib/actions/auth";
import { toast } from "@/lib/toast";

interface SifreSifirlaContentProps {
  token?: string;
}

export function SifreSifirlaContent({ token }: SifreSifirlaContentProps) {
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

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
      <div className="container">
        <div className="max-w-md mx-auto">
          <BlurFade delay={0.1} inView>
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
                  {isSuccess ? (
                    <CheckCircle className="h-7 w-7 text-green-500" />
                  ) : (
                    <KeyRound className="h-7 w-7 text-primary" />
                  )}
                </div>
                <CardTitle className="text-2xl">
                  {isSuccess ? "Şifre Güncellendi" : "Yeni Şifre Belirleyin"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!token ? (
                  <div className="space-y-4">
                    <p className="text-sm text-red-500 text-center">
                      Şifre sıfırlama bağlantısı geçersiz.
                    </p>
                    <Button asChild className="w-full">
                      <Link href="/musteri/sifremi-unuttum">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Şifremi Unuttum Sayfasına Dön
                      </Link>
                    </Button>
                  </div>
                ) : isSuccess ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center">
                      Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.
                    </p>
                    <Button asChild className="w-full">
                      <Link href="/musteri/giris">
                        Giriş Yap
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <form action={formAction} className="space-y-4">
                    <input type="hidden" name="token" value={token} />

                    <div className="space-y-2">
                      <Label htmlFor="password">Yeni Şifre</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          name="password"
                          type="password"
                          className="pl-10"
                          placeholder="En az 6 karakter"
                          required
                          disabled={isPending}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Yeni Şifre (Tekrar)</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          type="password"
                          className="pl-10"
                          placeholder="Yeni şifrenizi tekrar girin"
                          required
                          disabled={isPending}
                        />
                      </div>
                    </div>

                    {state && !state.success && state.error ? (
                      <p className="text-sm text-red-500">{state.error}</p>
                    ) : null}

                    <Button type="submit" className="w-full" disabled={isPending}>
                      {isPending ? "Güncelleniyor..." : "Şifreyi Güncelle"}
                    </Button>

                    <Button variant="outline" asChild className="w-full">
                      <Link href="/musteri/giris">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Giriş Sayfasına Dön
                      </Link>
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </BlurFade>
        </div>
      </div>
    </section>
  );
}

