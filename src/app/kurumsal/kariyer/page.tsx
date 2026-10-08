import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Briefcase, FileText, Github, Mail, MessageSquare, Users } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { FeatureGrid, type FeatureItem } from "@/components/site/feature-grid";
import { buttonClasses } from "@/components/site/button-classes";
import { Eyebrow } from "@/components/site/eyebrow";
import { SiteShell } from "@/components/site/kurumsal/site-shell";
import { GridPattern } from "@/components/site/kurumsal/grid-pattern";

export const metadata: Metadata = {
  title: "Kariyer",
  description:
    "KLEACORE'da şu anda açık pozisyon bulunmuyor. Genel başvurunuzu careers@kleacore.com adresine veya iletişim formundan gönderebilirsiniz.",
  alternates: { canonical: "/kurumsal/kariyer" },
  openGraph: {
    title: "Kariyer | KLEACORE",
    description: "Açık pozisyonlar ve genel başvuru bilgileri.",
    url: "/kurumsal/kariyer",
  },
};

const CAREERS_EMAIL = "careers@kleacore.com";
const generalApplicationHref = `/iletisim?konu=${encodeURIComponent("Açık Kariyer Başvurusu")}`;

const applicationItems: FeatureItem[] = [
  {
    icon: FileText,
    title: "Özgeçmiş",
    description: "Güncel özgeçmişinizi PDF olarak ekleyin.",
  },
  {
    icon: Github,
    title: "Çalışma örnekleri",
    description: "Varsa portfolyo, GitHub profili veya üzerinde çalıştığınız projelerin bağlantıları.",
  },
  {
    icon: Briefcase,
    title: "İlgi alanınız",
    description: "Yazılım, altyapı, destek veya satış gibi hangi alanda çalışmak istediğinizi belirtin.",
  },
];

const culture: FeatureItem[] = [
  {
    icon: MessageSquare,
    title: "Açık iletişim",
    description: "Fikirlerin özgürce paylaşıldığı, doğrudan ve sade bir çalışma ortamı.",
  },
  {
    icon: Users,
    title: "Birlikte öğrenme",
    description: "Teknolojiye ve kişisel gelişime yatırım yapan, birbirinden öğrenen bir ekip.",
  },
];

/** Skeleton rows behind the empty state (decorative). */
function GhostRow({ className }: { className?: string }) {
  return (
    <div aria-hidden className={`flex items-center gap-4 rounded-lg border bg-background p-4 ${className ?? ""}`}>
      <span className="size-9 shrink-0 rounded-md border bg-muted/60" />
      <span className="flex-1 space-y-2">
        <span className="block h-2.5 w-2/5 rounded-full bg-muted" />
        <span className="block h-2 w-3/5 rounded-full bg-muted/70" />
      </span>
      <span className="hidden h-7 w-20 rounded-md border bg-muted/40 sm:block" />
    </div>
  );
}

export default function KariyerPage() {
  return (
    <SiteShell>
      <PageHeader
        eyebrow="Kariyer"
        title="KLEACORE'da çalışmak"
        description="2026'da kurulan ekibimizle hosting, sunucu ve alan adı hizmetleri geliştiriyoruz. Açık pozisyonlarımızı bu sayfada duyururuz."
        breadcrumbs={[{ label: "Kurumsal" }, { label: "Kariyer" }]}
      />

      {/* Open positions — honest empty state */}
      <Section aria-labelledby="acik-pozisyonlar">
        <SectionHeading
          id="acik-pozisyonlar"
          eyebrow="Açık pozisyonlar"
          title="Şu anda açık pozisyon yok"
          description="Şu an aktif bir işe alım sürecimiz bulunmuyor. Yine de bizimle çalışmak isterseniz genel başvurunuzu memnuniyetle değerlendiririz."
          className="mb-10"
        />

        <div className="relative overflow-hidden rounded-2xl border bg-muted/30">
          <GridPattern />
          <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:p-14">
            <div>
              <span className="flex size-12 items-center justify-center rounded-lg border bg-background shadow-sm">
                <Briefcase aria-hidden className="size-5 text-foreground/80" />
              </span>
              <h3 className="mt-6 text-2xl font-semibold tracking-tight">Genel başvuru</h3>
              <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">
                Özgeçmişinizi ve ilgilendiğiniz alanı e-posta ile gönderin ya da iletişim formunu
                kullanın. Uygun bir pozisyon açıldığında sizinle iletişime geçeriz.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href={`mailto:${CAREERS_EMAIL}`} className={buttonClasses()}>
                  <Mail aria-hidden className="size-4" />
                  {CAREERS_EMAIL}
                </a>
                <Link href={generalApplicationHref} className={buttonClasses({ variant: "outline" })}>
                  İletişim formu
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              </div>
            </div>

            <div aria-hidden className="relative hidden sm:block">
              <div className="space-y-3 [mask-image:linear-gradient(to_bottom,black_40%,transparent)]">
                <GhostRow />
                <GhostRow className="opacity-80" />
                <GhostRow className="opacity-60" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="rounded-full border bg-background px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground shadow-sm">
                  0 açık pozisyon
                </span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="muted" divider aria-labelledby="basvuru-icerigi">
        <SectionHeading
          id="basvuru-icerigi"
          eyebrow="Başvuru"
          title="Başvurunuzda neler olsun?"
          className="mb-12"
        />
        <FeatureGrid items={applicationItems} columns={3} />
      </Section>

      <Section divider aria-labelledby="kulturumuz">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-16">
          <div>
            <Eyebrow>Kültürümüz</Eyebrow>
            <h2 id="kulturumuz" className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Küçük, odaklı bir ekip
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Açık iletişim ve sürekli öğrenmeyle birlikte büyüyoruz. Her fikir değerlidir ve
              herkes katkıda bulunabilir.
            </p>
          </div>
          <FeatureGrid items={culture} columns={2} />
        </div>
      </Section>
    </SiteShell>
  );
}
