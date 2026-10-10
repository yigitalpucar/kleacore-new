import Link from "next/link";
import { LogIn, Pencil, UserRound, UserPlus } from "lucide-react";
import { buttonClasses } from "@/components/site/button-classes";
import type { LegalBuyer } from "@/lib/legal/render";

const LOGIN_HREF = "/musteri/giris?callbackUrl=%2Fsepet";
const REGISTER_HREF = "/musteri/giris?mod=kayit&callbackUrl=%2Fsepet";

/**
 * "Bilgiler" step of the cart: the buyer the invoices and the distance-sales
 * contract are issued to, or a login prompt for guests.
 */
export function BuyerInfoCard({ buyer, signedIn }: { buyer: LegalBuyer | null; signedIn: boolean }) {
  return (
    <section aria-labelledby="sepet-bilgiler" className="mt-8">
      <h2 id="sepet-bilgiler" className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Fatura bilgileri
      </h2>
      {!signedIn || !buyer ? (
        <div className="rounded-2xl border border-dashed bg-background p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
              <UserRound aria-hidden className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="font-medium">Devam etmek için giriş yapın</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Faturalar ve sözleşme, müşteri hesabınızdaki bilgilerle düzenlenir. Sepetiniz bu cihazda saklanır;
                giriş yaptıktan sonra kaldığınız yerden devam edersiniz.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link href={LOGIN_HREF} className={buttonClasses({ className: "sm:flex-1" })}>
              <LogIn aria-hidden className="size-4" />
              Giriş yap
            </Link>
            <Link href={REGISTER_HREF} className={buttonClasses({ variant: "outline", className: "sm:flex-1" })}>
              <UserPlus aria-hidden className="size-4" />
              Hesap oluştur
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-background p-5">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Ad soyad / unvan</dt>
              <dd className="mt-0.5 break-words font-medium">{buyer.name || "—"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">E-posta</dt>
              <dd className="mt-0.5 break-all">{buyer.email}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Telefon</dt>
              <dd className="mt-0.5">{buyer.phone || <span className="text-muted-foreground">Eklenmemiş</span>}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Adres</dt>
              <dd className="mt-0.5 break-words">
                {buyer.address || <span className="text-muted-foreground">Eklenmemiş</span>}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed pt-4">
            <p className="text-xs text-muted-foreground">
              Faturalar ve Mesafeli Satış Sözleşmesi bu bilgilerle düzenlenir.
            </p>
            <Link
              href="/musteri/panel/ayarlar"
              className={buttonClasses({ variant: "ghost", size: "sm", className: "min-h-11" })}
            >
              <Pencil aria-hidden className="size-3.5" />
              Bilgileri düzenle
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
