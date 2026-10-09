import type { Metadata } from "next";
import Link from "next/link";
import { AuthAlert, AuthShell } from "@/components/auth/auth-shell";
import { buttonClasses } from "@/components/site";
import { setMarketingConsent, verifyUnsubscribeToken } from "@/lib/broadcasts/consent";
import { getRequestMeta } from "@/lib/request-meta";

export const metadata: Metadata = {
  title: "Abonelikten çık",
  description: "KLEACORE kampanya e-postalarından çıkın.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Target of the unsubscribe link in marketing broadcasts. One click: a valid
 * signed link withdraws the marketing consent immediately (idempotent).
 * Service and maintenance notices are not affected.
 */
export default async function AbonelikIptalPage({ searchParams }: { searchParams: Promise<{ t?: string | string[] }> }) {
  const { t } = await searchParams;
  const token = Array.isArray(t) ? t[0] : t;
  const userId = verifyUnsubscribeToken(token);
  const meta = await getRequestMeta();
  const result = userId
    ? await setMarketingConsent(userId, false, { source: "unsubscribe_link", ipAddress: meta.ip, userAgent: meta.userAgent })
    : null;
  const ok = Boolean(result?.found);

  return (
    <AuthShell
      eyebrow="E-posta tercihleri"
      title={ok ? "Kampanya e-postalarından çıktınız" : "Bağlantı geçersiz"}
      description={
        ok
          ? "Artık kampanya ve tanıtım içerikli e-posta ve SMS almayacaksınız. Hizmetlerinizle ilgili bakım, kesinti ve fatura bildirimleri gönderilmeye devam eder."
          : undefined
      }
    >
      <div className="space-y-5">
        {ok ? (
          <p className="text-sm text-muted-foreground">
            Fikrinizi değiştirirseniz müşteri panelinde <strong>Hesap ayarları → Bildirimler</strong> bölümünden kampanya
            iletilerini yeniden açabilirsiniz.
          </p>
        ) : (
          <AuthAlert>
            Abonelikten çıkma bağlantısı geçersiz veya eksik. Bağlantıyı e-postadan eksiksiz açtığınızdan emin olun ya da
            müşteri panelinden tercihlerinizi değiştirin.
          </AuthAlert>
        )}
        <Link href="/musteri/panel/ayarlar" className={buttonClasses({ variant: "outline", className: "w-full" })}>
          Bildirim tercihlerine git
        </Link>
      </div>
    </AuthShell>
  );
}
