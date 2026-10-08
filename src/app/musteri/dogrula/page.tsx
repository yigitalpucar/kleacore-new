import type { Metadata } from "next";
import Link from "next/link";
import { AuthAlert, AuthShell } from "@/components/auth/auth-shell";
import { buttonClasses } from "@/components/site";
import { auth } from "@/lib/auth";
import { consumeEmailVerificationToken } from "@/lib/auth/email-verification";
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";

export const metadata: Metadata = {
  title: "E-posta Doğrulama",
  description: "KLEACORE hesabınızın e-posta adresini doğrulayın.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const failureText = {
  invalid: "Doğrulama bağlantısı geçersiz. Bağlantıyı e-postadan eksiksiz kopyaladığınızdan emin olun.",
  expired: "Doğrulama bağlantısının süresi dolmuş. Yeni bir bağlantı isteyebilirsiniz.",
  used: "Bu doğrulama bağlantısı daha önce kullanılmış. Gerekirse yeni bir bağlantı isteyin.",
} as const;

export default async function DogrulaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const rawToken = Array.isArray(token) ? token[0] : token;
  const result = rawToken
    ? await consumeEmailVerificationToken(rawToken)
    : ({ ok: false, reason: "invalid" } as const);
  const session = result.ok ? null : await auth();

  return (
    <AuthShell
      eyebrow="E-posta doğrulama"
      title={result.ok ? "E-posta adresiniz doğrulandı" : "Doğrulama tamamlanamadı"}
      description={
        result.ok
          ? result.alreadyVerified
            ? "Bu hesap zaten doğrulanmış. Sipariş verebilir ve ödeme yapabilirsiniz."
            : "Teşekkürler. Artık sipariş verebilir ve ödeme yapabilirsiniz."
          : undefined
      }
    >
      <div className="space-y-5">
        {result.ok ? (
          <Link href="/musteri/panel" className={buttonClasses({ className: "w-full" })}>
            Müşteri paneline git
          </Link>
        ) : (
          <>
            <AuthAlert>{failureText[result.reason]}</AuthAlert>
            {session?.user ? (
              <EmailVerificationBanner email={session.user.email} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Yeni bir doğrulama bağlantısı almak için giriş yapın; panelin üst kısmındaki
                &quot;Doğrulama e-postasını tekrar gönder&quot; düğmesini kullanabilirsiniz.
              </p>
            )}
            <Link
              href={session?.user ? "/musteri/panel" : "/musteri/giris"}
              className={buttonClasses({ variant: "outline", className: "w-full" })}
            >
              {session?.user ? "Müşteri paneline dön" : "Giriş yap"}
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}
