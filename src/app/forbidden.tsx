import type { Metadata } from "next";
import Link from "next/link";
import { Home } from "lucide-react";
import { Container } from "@/components/site/container";
import { Eyebrow } from "@/components/site/eyebrow";
import { buttonClasses } from "@/components/site/button-classes";
import { SiteShell } from "@/components/site/kurumsal/site-shell";

export const metadata: Metadata = {
  title: "Erişim yetkiniz yok",
  robots: { index: false },
};

/** Root 403 (forbidden()) outside the admin shell. */
export default function Forbidden() {
  return (
    <SiteShell>
      <Container className="py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Hata 403</Eyebrow>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Erişim yetkiniz yok</h1>
          <p className="mx-auto mt-4 max-w-md text-pretty text-muted-foreground">
            Bu sayfayı görüntülemek için gereken yetki hesabınızda tanımlı değil.
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/" className={buttonClasses()}>
              <Home aria-hidden className="size-4" />
              Ana sayfaya git
            </Link>
          </div>
        </div>
      </Container>
    </SiteShell>
  );
}
