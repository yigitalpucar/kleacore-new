"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AuthAlert, AuthShell } from "@/components/auth/auth-shell";
import { buttonClasses } from "@/components/site";
import { confirmDataRequestAction } from "@/lib/actions/public/privacy";
import { formatDate } from "@/lib/format/date";

const aside = {
  label: "KVKK başvurusu",
  heading: "Son adım: başvurunuzu onaylayın.",
  text: "Onayladığınızda başvurunuz kayda alınır ve 30 günlük yasal yanıt süresi başlar.",
  points: ["Onay e-posta adresinizin size ait olduğunu gösterir", "Sonuç bu e-posta adresine gönderilir"],
};

const failureText = {
  invalid: "Onay bağlantısı geçersiz. Bağlantıyı e-postadan eksiksiz açtığınızdan emin olun.",
  expired: "Onay bağlantısının süresi dolmuş; başvuru iptal edildi. Lütfen formu yeniden doldurun.",
  already_confirmed: "Bu başvuru daha önce onaylanmış.",
} as const;

type Result = Awaited<ReturnType<typeof confirmDataRequestAction>>;

export function ConfirmDataRequest({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function confirm() {
    setPending(true);
    const formData = new FormData();
    formData.set("token", token);
    setResult(await confirmDataRequestAction(formData));
    setPending(false);
  }

  if (result?.ok) {
    return (
      <AuthShell eyebrow="Başvuru onaylandı" title="Başvurunuz kayda alındı" aside={aside}>
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p>
              <span className="font-mono">{result.requestNumber}</span> numaralı başvurunuzu en geç{" "}
              <strong>{formatDate(result.dueAt)}</strong> tarihine kadar sonuçlandıracağız. Onay e-postası gönderildi.
            </p>
          </div>
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
      title="Başvurunuzu onaylayın"
      description="Aşağıdaki düğmeyle bu e-posta adresinin size ait olduğunu onaylayın."
      aside={aside}
    >
      <div className="space-y-5">
        {result && !result.ok ? (
          <AuthAlert>
            {failureText[result.reason]}
            {result.requestNumber ? ` (${result.requestNumber})` : null}
          </AuthAlert>
        ) : null}
        {!token ? <AuthAlert>{failureText.invalid}</AuthAlert> : null}
        {result && !result.ok ? (
          <Link href="/yasal/kvkk-basvuru" className={buttonClasses({ variant: "outline", className: "w-full" })}>
            Başvuru formuna dön
          </Link>
        ) : (
          <button type="button" onClick={confirm} disabled={pending || !token} className={buttonClasses({ className: "w-full" })}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-label="Onaylanıyor" /> : "Başvurumu onayla"}
          </button>
        )}
      </div>
    </AuthShell>
  );
}
