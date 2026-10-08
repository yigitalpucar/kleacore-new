import Link from "next/link";
import { ArrowDown, ArrowRight, Gauge, Network, Server, ShieldCheck } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/site/button-classes";
import { CtaBand } from "@/components/site/cta-band";
import { FaqSection, type FaqItem } from "@/components/site/faq-section";
import { FeatureGrid, type FeatureItem } from "@/components/site/feature-grid";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { TrustBar, type TrustBarItem } from "@/components/site/trust-bar";
import { IstanbulMap } from "./istanbul-map";

export type DcService = "barindirma" | "cdn" | "ddos-koruma" | "ip-asn";

const services: { key: DcService; title: string; description: string; icon: typeof Server }[] = [
  {
    key: "barindirma",
    title: "Sunucu barındırma",
    description: "Kendi sunucunuzu İstanbul'daki raf alanımızda barındırın.",
    icon: Server,
  },
  {
    key: "ip-asn",
    title: "IPv4 ve ASN",
    description: "RIPE kayıtlı IPv4 blokları ve ASN kiralama.",
    icon: Network,
  },
  {
    key: "ddos-koruma",
    title: "DDoS koruma",
    description: "Ağ ve uygulama katmanında saldırı filtreleme paketleri.",
    icon: ShieldCheck,
  },
  {
    key: "cdn",
    title: "CDN",
    description: "Statik içeriklerinizi önbelleğe alarak sitenizi hızlandırın.",
    icon: Gauge,
  },
];

export interface DcLandingProps {
  service: DcService;
  eyebrow: string;
  title: string;
  description: string;
  breadcrumb: string;
  trustItems: TrustBarItem[];
  /** Plan sections (rendered right after the trust bar). */
  children: React.ReactNode;
  /** Show the İstanbul location map section. */
  map?: { title: string; description: string; facts: { label: string; value: string }[] };
  featuresTitle: string;
  featuresDescription?: string;
  features: FeatureItem[];
  faqs: FaqItem[];
  faqDescription: string;
  cta: { title: string; description: string };
}

/** Shared layout for /veri-merkezi/{barindirma,cdn,ddos-koruma,ip-asn}. */
export function DcLanding(props: DcLandingProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <PageHeader
          eyebrow={props.eyebrow}
          title={props.title}
          description={props.description}
          breadcrumbs={[
            { label: "Veri Merkezi", href: "/veri-merkezi/barindirma" },
            { label: props.breadcrumb },
          ]}
          actions={
            <>
              <a href="#paketler" className={buttonClasses({ size: "lg" })}>
                Paketleri gör
                <ArrowDown aria-hidden className="size-4" />
              </a>
              <Link href="/iletisim" className={buttonClasses({ variant: "outline", size: "lg" })}>
                Teklif isteyin
              </Link>
            </>
          }
        />

        <TrustBar items={props.trustItems} bordered={false} />

        <div id="paketler" className="scroll-mt-20">
          {props.children}
        </div>

        {props.map ? (
          <Section tone="muted" divider aria-labelledby="lokasyon-heading">
            <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div>
                <SectionHeading
                  id="lokasyon-heading"
                  eyebrow="Lokasyon"
                  title={props.map.title}
                  description={props.map.description}
                />
                <dl className="mt-8 divide-y divide-dashed border-y border-dashed text-sm">
                  {props.map.facts.map((fact) => (
                    <div key={fact.label} className="flex items-center justify-between gap-4 py-3">
                      <dt className="text-muted-foreground">{fact.label}</dt>
                      <dd className="text-right font-medium">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <IstanbulMap />
            </div>
          </Section>
        ) : null}

        <Section divider aria-labelledby="ozellikler-heading">
          <SectionHeading
            id="ozellikler-heading"
            eyebrow="Özellikler"
            title={props.featuresTitle}
            description={props.featuresDescription}
            className="mb-12"
          />
          <FeatureGrid items={props.features} columns={3} />
        </Section>

        <Section tone="muted" divider aria-labelledby="hizmetler-heading">
          <SectionHeading
            id="hizmetler-heading"
            eyebrow="Veri merkezi"
            title="Diğer veri merkezi hizmetleri"
            className="mb-10"
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => {
              const current = s.key === props.service;
              const Icon = s.icon;
              return (
                <li key={s.key}>
                  <Link
                    href={`/veri-merkezi/${s.key}`}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "group flex h-full flex-col rounded-2xl border bg-background p-5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      current && "ring-1 ring-foreground/30"
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex size-9 items-center justify-center rounded-md border">
                        <Icon aria-hidden className="size-4" />
                      </span>
                      {current ? (
                        <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          Bu sayfa
                        </span>
                      ) : (
                        <ArrowRight
                          aria-hidden
                          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        />
                      )}
                    </span>
                    <span className="mt-4 font-semibold">{s.title}</span>
                    <span className="mt-1 text-sm text-muted-foreground">{s.description}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>

        <FaqSection items={props.faqs} description={props.faqDescription} divider />

        <CtaBand
          eyebrow="Teklif"
          title={props.cta.title}
          description={props.cta.description}
          primary={{ label: "Bize ulaşın", href: "/iletisim" }}
          secondary={{ label: "Paketleri gör", href: `/veri-merkezi/${props.service}#paketler` }}
        />
      </main>
      <Footer />
    </div>
  );
}
