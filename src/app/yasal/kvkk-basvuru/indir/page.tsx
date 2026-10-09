import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { AuthAlert, AuthShell } from "@/components/auth/auth-shell";
import { buttonClasses } from "@/components/site";

export const metadata: Metadata = {
  title: "KVKK Veri Kopyası",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const aside = {
  label: "KVKK veri kopyası",
  heading: "Verilerinizin kopyası hazır.",
  text: "Dosya, hakkınızda tuttuğumuz kişisel verileri JSON ve CSV biçiminde içerir.",
  points: ["Bağlantı yalnızca bir kez kullanılabilir", "İndirilen dosya sunucularımızdan silinir", "Dosyayı güvenli bir yerde saklayın"],
};

const errors: Record<string, string> = {
  invalid: "İndirme bağlantısı geçersiz.",
  used: "Bu bağlantı daha önce kullanıldı; dosya güvenlik nedeniyle silindi. Yeni bir kopya için yeniden başvurabilirsiniz.",
  expired: "İndirme bağlantısının süresi dolmuş. Yeni bir kopya için yeniden başvurabilirsiniz.",
  missing: "Dosya bulunamadı. Lütfen bizimle iletişime geçin.",
  limit: "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.",
};

export default async function KvkkIndirPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; hata?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = (Array.isArray(params.token) ? params.token[0] : params.token) ?? "";
  const error = Array.isArray(params.hata) ? params.hata[0] : params.hata;

  return (
    <AuthShell
      eyebrow="KVKK başvurusu"
      title="Veri kopyanızı indirin"
      description="Dosya tek kullanımlıktır: indirdikten sonra bağlantı geçersiz olur."
      aside={aside}
    >
      <div className="space-y-5">
        {error ? <AuthAlert>{errors[error] ?? errors.invalid}</AuthAlert> : null}
        {token && !error ? (
          <form method="post" action="/api/kvkk/indir">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className={buttonClasses({ className: "w-full" })}>
              <Download className="size-4" aria-hidden />
              Dosyayı indir (.zip)
            </button>
          </form>
        ) : (
          <Link href="/yasal/kvkk-basvuru" className={buttonClasses({ variant: "outline", className: "w-full" })}>
            Başvuru formuna git
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
