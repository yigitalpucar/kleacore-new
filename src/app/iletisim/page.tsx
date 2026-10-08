import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { BookOpen, Building2, Clock, LifeBuoy, Mail, MapPin } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { Eyebrow } from "@/components/site/eyebrow";
import { buttonClasses } from "@/components/site/button-classes";
import { SiteShell } from "@/components/site/kurumsal/site-shell";
import { getTurnstileSiteKey } from "@/lib/security/turnstile";
import { IletisimForm } from "./content";

// Turnstile keys are runtime configuration (env / admin settings).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "İletişim",
  description:
    "KLEACORE ile iletişime geçin: iletişim formu, destek ve satış e-posta adresleri, çalışma saatleri ve KLEAWORK DIGITAL LLC şirket bilgileri.",
  alternates: { canonical: "/iletisim" },
  openGraph: {
    title: "İletişim | KLEACORE",
    description: "Formu doldurun veya ilgili birime e-posta gönderin; en kısa sürede dönüş yapalım.",
    url: "/iletisim",
  },
};

const departments = [
  { name: "Teknik Destek", email: "support@kleacore.com", description: "Teknik sorunlar ve yardım" },
  { name: "Satış", email: "sales@kleacore.com", description: "Yeni projeler ve fiyatlandırma" },
  { name: "Muhasebe", email: "billing@kleacore.com", description: "Fatura ve ödeme işlemleri" },
  { name: "Genel", email: "info@kleacore.com", description: "Diğer tüm konular" },
];

const details = [
  {
    icon: Clock,
    title: "Çalışma saatleri",
    lines: ["Teknik destek: 7/24", "Satış: Hafta içi 09:00–18:00"],
  },
  {
    icon: MapPin,
    title: "Adres",
    lines: ["30 N Gould St Ste R", "Sheridan, WY 82801, USA"],
  },
  {
    icon: Building2,
    title: "Şirket",
    lines: ["KLEAWORK DIGITAL LLC", "EIN: 36-5157418"],
  },
];

export default async function IletisimPage() {
  const turnstileSiteKey = await getTurnstileSiteKey();
  return (
    <SiteShell>
      <PageHeader
        eyebrow="İletişim"
        title="Bize ulaşın"
        description="Sorularınız için formu doldurun veya ilgili birime doğrudan e-posta gönderin. Sizin dilinizden konuşan ekibimiz yardımcı olmaktan mutluluk duyar."
        breadcrumbs={[{ label: "Kurumsal" }, { label: "İletişim" }]}
      />

      {/* Contact grid: details + form */}
      <Section aria-labelledby="iletisim-formu">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col">
            <span className="flex size-12 items-center justify-center rounded-lg border bg-muted/40 shadow-sm">
              <Mail aria-hidden className="size-5 text-foreground/80" />
            </span>
            <SectionHeading
              id="iletisim-formu"
              title="Bize yazın"
              description="Formu doldurun, en kısa sürede size dönüş yapalım. Mevcut bir hizmetinizle ilgili teknik sorunlar için müşteri panelinden destek talebi açmanız daha hızlı sonuç verir."
              className="mt-8"
            />

            <ul className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="mailto:support@kleacore.com"
                  className="inline-flex min-h-11 items-center font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  support@kleacore.com
                </a>
              </li>
              <li aria-hidden className="size-1 rounded-full bg-muted-foreground/60" />
              <li>Destek talepleri 7/24 alınır</li>
            </ul>

            <dl className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {details.map((item) => (
                <div key={item.title} className="bg-background p-5">
                  <dt className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    <item.icon aria-hidden className="size-3.5" />
                    {item.title}
                  </dt>
                  {item.lines.map((line) => (
                    <dd key={line} className="mt-1.5 text-sm font-medium first-of-type:mt-3">
                      {line}
                    </dd>
                  ))}
                </div>
              ))}
            </dl>
          </div>

          <Suspense fallback={<div className="min-h-[34rem] rounded-2xl border bg-muted/30" />}>
            <IletisimForm turnstileSiteKey={turnstileSiteKey} />
          </Suspense>
        </div>
      </Section>

      {/* Departments */}
      <Section tone="muted" divider aria-labelledby="birimler">
        <SectionHeading
          id="birimler"
          eyebrow="Birimler"
          title="Doğrudan ilgili birime yazın"
          description="Konunuza uygun adrese yazmanız talebinizin doğru ekibe daha hızlı ulaşmasını sağlar."
          className="mb-10"
        />
        <ul className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {departments.map((dept) => (
            <li key={dept.email} className="flex flex-col bg-background p-6">
              <h3 className="text-base font-medium tracking-tight">{dept.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{dept.description}</p>
              <a
                href={`mailto:${dept.email}`}
                className="mt-4 inline-flex min-h-11 items-center gap-2 break-all text-sm font-medium underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Mail aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                {dept.email}
              </a>
            </li>
          ))}
        </ul>
      </Section>

      {/* Self-service */}
      <Section divider aria-labelledby="hizli-yanit">
        <div className="grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-2">
          <div className="bg-background p-8 md:p-10">
            <Eyebrow>Hızlı yanıt</Eyebrow>
            <h2 id="hizli-yanit" className="mt-4 text-2xl font-semibold tracking-tight">
              Cevabınız bilgi bankasında olabilir
            </h2>
            <p className="mt-3 text-muted-foreground">
              Hosting, alan adı, SSL ve sunucu konularındaki rehberlerimize istediğiniz zaman
              göz atabilirsiniz.
            </p>
            <Link
              href="/bilgi-bankasi"
              className={buttonClasses({ variant: "outline", className: "mt-6" })}
            >
              <BookOpen aria-hidden className="size-4" />
              Bilgi bankası
            </Link>
          </div>
          <div className="bg-background p-8 md:p-10">
            <Eyebrow>Müşteriler için</Eyebrow>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight">
              Hizmetinizle ilgili destek
            </h3>
            <p className="mt-3 text-muted-foreground">
              Mevcut bir hizmetiniz için destek merkezinden talep oluşturabilir, taleplerinizin
              durumunu müşteri panelinden takip edebilirsiniz.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/musteri/destek" className={buttonClasses()}>
                <LifeBuoy aria-hidden className="size-4" />
                Destek merkezi
              </Link>
              <Link href="/musteri/panel" className={buttonClasses({ variant: "outline" })}>
                Müşteri paneli
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </SiteShell>
  );
}
