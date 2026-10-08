import {
  ArrowDown,
  Cable,
  Check,
  HardDrive,
  Headphones,
  MapPin,
  MonitorCog,
  Terminal,
  Wrench,
} from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { buttonClasses } from "@/components/site/button-classes";
import { CtaBand } from "@/components/site/cta-band";
import { FaqSection, type FaqItem } from "@/components/site/faq-section";
import { FeatureGrid, type FeatureItem } from "@/components/site/feature-grid";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { TrustBar, type TrustBarItem } from "@/components/site/trust-bar";
import { CartPlanTable, type CartPlanColumn, type CartPlanRow } from "./cart-plan-table";
import { ServerComparison } from "./server-comparison";
import { serverFamilyMeta, type FamilySummary, type ServerFamilyKey } from "./server-catalog";

export interface ServerLandingProps {
  family: ServerFamilyKey;
  eyebrow: string;
  title: string;
  description: string;
  breadcrumb: string;
  plansTitle: string;
  plansDescription: string;
  rows: CartPlanRow[];
  columns: CartPlanColumn[];
  included: string[];
  summaries: FamilySummary[];
  trustItems: TrustBarItem[];
  featuresTitle: string;
  featuresDescription?: string;
  features: FeatureItem[];
  faqs: FaqItem[];
  /** Extra sections rendered between the plans and the comparison. */
  children?: React.ReactNode;
  cta: { title: string; description: string };
}

/** Shared layout for /sunucu/{vps,vds,bulut,fiziksel}. */
export function ServerLanding(props: ServerLandingProps) {
  const meta = serverFamilyMeta[props.family];

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <PageHeader
          eyebrow={props.eyebrow}
          title={props.title}
          description={props.description}
          breadcrumbs={[{ label: "Sunucu", href: "/sunucu/vds" }, { label: props.breadcrumb }]}
          actions={
            <>
              <a href="#paketler" className={buttonClasses({ size: "lg" })}>
                Paketleri gör
                <ArrowDown aria-hidden className="size-4" />
              </a>
              <a href="#karsilastirma" className={buttonClasses({ variant: "outline", size: "lg" })}>
                Hangisi bana uygun?
              </a>
            </>
          }
        />

        <TrustBar items={props.trustItems} bordered={false} />

        <Section id="paketler" divider aria-labelledby="paketler-heading" className="scroll-mt-20">
          <SectionHeading
            id="paketler-heading"
            align="center"
            eyebrow={`${meta.noun} paketleri`}
            title={props.plansTitle}
            description={props.plansDescription}
            className="mb-10"
          />
          {props.rows.length > 0 ? (
            <CartPlanTable
              plans={props.rows}
              columns={props.columns}
              target={{ kind: "server", category: meta.cartCategory }}
              caption={`${props.breadcrumb} paketleri`}
            />
          ) : (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Şu anda satışta paket bulunmuyor. Bilgi için support@kleacore.com adresine yazabilirsiniz.
            </p>
          )}

          {props.included.length > 0 ? (
            <div className="mt-10 rounded-xl border border-dashed p-5 sm:p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Tüm {meta.noun} paketlerinde
              </p>
              <ul className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {props.included.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-muted"
                    >
                      <Check className="size-2.5 stroke-[3]" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>

        {props.children}

        <div id="karsilastirma" className="scroll-mt-20">
          <ServerComparison summaries={props.summaries} current={props.family} />
        </div>

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

        <FaqSection
          items={props.faqs}
          description={`${meta.noun.charAt(0).toLocaleUpperCase("tr")}${meta.noun.slice(1)} hizmetimiz hakkında merak edilenler.`}
          tone="muted"
          divider
        />

        <CtaBand
          eyebrow="Destek"
          title={props.cta.title}
          description={props.cta.description}
          primary={{ label: "Paketleri gör", href: `${meta.href}#paketler` }}
          secondary={{ label: "Bize ulaşın", href: "/iletisim" }}
        />
      </main>
      <Footer />
    </div>
  );
}

/** Factual trust strip for a server family, built from the DB summary. */
export function familyTrustItems(s: FamilySummary | undefined): TrustBarItem[] {
  const items: TrustBarItem[] = [];
  if (s?.diskType) {
    items.push({ icon: HardDrive, label: s.diskType === "NVMe" ? "NVMe SSD" : s.diskType, description: "Disk altyapısı" });
  }
  if (s?.port) items.push({ icon: Cable, label: s.port, description: "Port hızı" });
  items.push({ icon: Terminal, label: "Tam root", description: "Yönetici erişimi" });
  items.push({ icon: MapPin, label: "İstanbul", description: "Sunucu lokasyonu" });
  if (s?.hasConsole) items.push({ icon: MonitorCog, label: "IPMI / KVM", description: "Uzaktan konsol" });
  else if (s?.freeSetup) items.push({ icon: Wrench, label: "Ücretsiz kurulum", description: "Kurulum ücreti yok" });
  items.push({ icon: Headphones, label: "7/24 Destek", description: "Destek talebi ve e-posta" });
  return items;
}
