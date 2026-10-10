import Link from "next/link";
import { Mail } from "lucide-react";
import { Container } from "@/components/site/container";
import { StatusDot } from "@/components/site/status-pill";

const linkClass =
  "inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Thin information bar above the header (tablet/desktop only — on phones
 * the same links live in the mobile menu). Factual content only.
 */
export function Topbar() {
  return (
    <aside
      aria-label="İletişim ve yardımcı bağlantılar"
      className="dark relative z-[60] hidden border-b border-white/10 bg-neutral-950 text-xs text-muted-foreground md:block">
      <Container className="flex h-9 items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <a href="mailto:support@kleacore.com" className={linkClass}>
            <Mail aria-hidden className="size-3.5" />
            support@kleacore.com
          </a>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] lg:inline">
            Fiyatlara KDV dahil değildir
          </span>
        </div>
        <nav aria-label="Yardımcı bağlantılar">
          <ul className="flex items-center gap-5">
            <li>
              <Link href="/bilgi-bankasi" className={linkClass}>
                Bilgi Bankası
              </Link>
            </li>
            <li>
              <Link href="/iletisim" className={linkClass}>
                İletişim
              </Link>
            </li>
            <li>
              <Link href="/musteri/durum" className={linkClass}>
                <StatusDot pulse={false} />
                Sistem Durumu
              </Link>
            </li>
          </ul>
        </nav>
      </Container>
    </aside>
  );
}
