"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { AuthAlert, AuthShell, authInputClass } from "@/components/auth/auth-shell";
import { DataRequestTypePicker } from "@/components/privacy/data-request-type-picker";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { buttonClasses } from "@/components/site";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitPublicDataRequestAction } from "@/lib/actions/public/privacy";
import type { DataRequestTypeValue } from "@/lib/privacy/labels";
import { toast } from "@/lib/toast";

const aside = {
  label: "KVKK başvurusu",
  heading: "Kişisel verileriniz üzerindeki haklarınız.",
  text: "6698 sayılı Kanun'un 11. maddesindeki haklarınızı bu formla kullanabilirsiniz. Başvurunuzu en geç 30 gün içinde ücretsiz olarak sonuçlandırırız.",
  points: [
    "Kimliğinizi e-posta doğrulamasıyla teyit ederiz",
    "30 günlük yasal süre onay anından başlar",
    "Veri kopyası tek kullanımlık bağlantıyla gönderilir",
    "Silme talebinde yasal saklama yükümlülükleri korunur",
  ],
};

export function KvkkBasvuruContent({ turnstileSiteKey, signedIn }: { turnstileSiteKey: string | null; signedIn: boolean }) {
  const [type, setType] = useState<DataRequestTypeValue | "">("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [done, setDone] = useState<{ email: string; requestNumber: string; debugVerifyUrl?: string } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    formData.set("confirm", formData.get("confirm") ? "true" : "");
    if (captchaToken) formData.set("cf-turnstile-response", captchaToken);
    const result = await submitPublicDataRequestAction(formData);
    setCaptchaReset((value) => value + 1);
    setPending(false);
    if (!result.success) {
      setError(result.error ?? "Başvuru gönderilemedi");
      toast.error(result.error ?? "Başvuru gönderilemedi");
      return;
    }
    setDone({
      email: String(formData.get("email") ?? ""),
      requestNumber: "requestNumber" in result ? result.requestNumber : "",
      debugVerifyUrl: "debugVerifyUrl" in result ? result.debugVerifyUrl : undefined,
    });
  }

  if (done) {
    return (
      <AuthShell
        eyebrow="Başvuru alındı"
        title="E-postanızı onaylayın"
        description="Başvurunuzun işleme alınması için size gönderdiğimiz bağlantıyla e-posta adresinizi doğrulayın."
        aside={aside}
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
            <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border bg-background">
              <MailCheck className="size-5" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="text-muted-foreground">Onay bağlantısı şu adrese gönderildi:</p>
              <p className="mt-1 truncate font-mono font-medium">{done.email}</p>
              <p className="mt-2 text-muted-foreground">
                Başvuru no: <span className="font-mono text-foreground">{done.requestNumber}</span>
              </p>
            </div>
          </div>
          {done.debugVerifyUrl ? (
            <AuthAlert tone="info">
              <p className="font-medium">Geliştirme ortamı</p>
              <a href={done.debugVerifyUrl} className="mt-1 block break-all underline underline-offset-4">
                {done.debugVerifyUrl}
              </a>
            </AuthAlert>
          ) : null}
          <p className="text-sm text-muted-foreground">Bağlantı 48 saat geçerlidir. Onaylanmayan başvurular işleme alınmaz.</p>
          <Link href="/" className={buttonClasses({ variant: "outline", className: "w-full" })}>
            Ana sayfaya dön
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="KVKK başvurusu"
      title="Veri sahibi başvuru formu"
      description="Hesabınıza kayıtlı e-posta adresini kullanın; başvurunuzu bu adresle eşleştiririz."
      aside={aside}
      footer={
        <p>
          {signedIn ? (
            <>
              Giriş yaptığınız için başvurunuzu{" "}
              <Link href="/musteri/panel/kvkk" className="font-medium text-foreground underline underline-offset-4 hover:no-underline">
                müşteri panelinden
              </Link>{" "}
              doğrulama gerekmeden yapabilirsiniz.
            </>
          ) : (
            <>
              Müşteriyseniz başvurunuzu{" "}
              <Link href="/musteri/giris?callbackUrl=/musteri/panel/kvkk" className="font-medium text-foreground underline underline-offset-4 hover:no-underline">
                giriş yaparak
              </Link>{" "}
              panelden de yapabilirsiniz. Ayrıntılar:{" "}
              <Link href="/yasal/kvkk" className="font-medium text-foreground underline underline-offset-4 hover:no-underline">
                KVKK Aydınlatma Metni
              </Link>
              .
            </>
          )}
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <DataRequestTypePicker value={type} onChange={setType} disabled={pending} />

        <div className="space-y-2">
          <Label htmlFor="kvkk-name">Ad soyad</Label>
          <Input id="kvkk-name" name="name" autoComplete="name" className={authInputClass} required disabled={pending} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kvkk-email">E-posta</Label>
          <Input id="kvkk-email" name="email" type="email" autoComplete="email" className={authInputClass} required disabled={pending} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kvkk-phone">Telefon (isteğe bağlı)</Label>
          <Input id="kvkk-phone" name="phone" type="tel" autoComplete="tel" className={authInputClass} disabled={pending} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kvkk-details">Talebinizin açıklaması</Label>
          <Textarea
            id="kvkk-details"
            name="details"
            rows={5}
            required
            minLength={10}
            maxLength={5000}
            disabled={pending}
            placeholder="Örn. düzeltilmesini istediğiniz bilgi ve doğrusu"
          />
        </div>
        <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <input type="checkbox" name="confirm" value="true" required className="mt-0.5 size-4 shrink-0 accent-foreground" disabled={pending} />
          <span>Bu başvuruyu kendi kişisel verilerim için yaptığımı ve verdiğim bilgilerin doğru olduğunu beyan ederim.</span>
        </label>

        <TurnstileWidget siteKey={turnstileSiteKey} action="kvkk-request" onToken={setCaptchaToken} resetKey={captchaReset} />

        {error ? <AuthAlert>{error}</AuthAlert> : null}

        <button
          type="submit"
          className={buttonClasses({ className: "w-full" })}
          disabled={pending || !type || (Boolean(turnstileSiteKey) && !captchaToken)}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Gönderiliyor…
            </>
          ) : (
            <>
              Başvuruyu gönder
              <ArrowRight className="size-4" aria-hidden />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
