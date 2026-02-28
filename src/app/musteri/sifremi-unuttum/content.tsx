"use client";

import { useState } from "react";
import { useActionState } from "react";
import { BlurFade } from "@/components/magicui/blur-fade";
import {
  Mail,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  CheckCircle,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/auth";
import { toast } from "@/lib/toast";

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
                  {isSuccess ? "E-posta Gönderildi" : "Şifremi Unuttum"}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-2">
                  {isSuccess
                    ? "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi."
                    : "E-posta adresinizi girin, şifre sıfırlama bağlantısı gönderelim."}
                </p>
              </CardHeader>
              <CardContent>
                {isSuccess ? (
                  <div className="space-y-6">
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-sm text-center">
                        <strong>{submittedEmail}</strong> adresine şifre sıfırlama
                        bağlantısı gönderildi. Lütfen gelen kutunuzu kontrol edin.
                      </p>
                    </div>

                    {debugResetUrl && (
                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm">
                        <p className="font-medium mb-1">Geliştirme Ortamı</p>
                        <p className="text-muted-foreground mb-2">
                          E-posta servisi tanımlı olmadığı için test linki:
                        </p>
                        <a
                          href={debugResetUrl}
                          className="break-all text-primary hover:underline"
                        >
                          {debugResetUrl}
                        </a>
                      </div>
                    )}

                    <div className="space-y-3 text-sm text-muted-foreground">
                      <p className="flex items-start gap-2">
                        <Shield className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                        <span>
                          Bağlantı 30 dakika içinde geçerliliğini yitirecektir.
                        </span>
                      </p>
                      <p className="flex items-start gap-2">
                        <Mail className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                        <span>
                          E-posta gelmezse spam klasörünü kontrol edin.
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setIsSuccess(false);
                          setSubmittedEmail("");
                          setDebugResetUrl(null);
                        }}
                      >
                        Farklı E-posta Dene
                      </Button>
                      <Button asChild className="w-full">
                        <Link href="/musteri/giris">
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Giriş Sayfasına Dön
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form action={formAction} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">E-posta Adresi</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="ornek@email.com"
                          className="pl-10"
                          required
                          disabled={isPending}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Kayıtlı e-posta adresinizi girin.
                      </p>
                    </div>

                    {state && !state.success && state.error && (
                      <p className="text-sm text-red-500">{state.error}</p>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isPending}
                    >
                      {isPending ? (
                        "Gönderiliyor..."
                      ) : (
                        <>
                          Sıfırlama Bağlantısı Gönder
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                          veya
                        </span>
                      </div>
                    </div>

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

          {/* Help Section */}
          <BlurFade delay={0.2} inView>
            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Hala sorun mu yaşıyorsunuz?
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/musteri/destek"
                  className="text-sm text-primary hover:underline"
                >
                  Destek Talebi Oluştur
                </Link>
                <span className="text-muted-foreground">•</span>
                <Link
                  href="/iletisim"
                  className="text-sm text-primary hover:underline"
                >
                  Bize Ulaşın
                </Link>
              </div>
            </div>
          </BlurFade>
        </div>
      </div>
    </section>
  );
}
