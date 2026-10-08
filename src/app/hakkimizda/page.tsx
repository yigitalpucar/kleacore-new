import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Eye,
  Globe,
  Headphones,
  HeartHandshake,
  Lightbulb,
  Lock,
  MapPin,
  Server,
  Shield,
  Target,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { FeatureGrid, type FeatureItem } from "@/components/site/feature-grid";
import { TrustBar, type TrustBarItem } from "@/components/site/trust-bar";
import { CtaBand } from "@/components/site/cta-band";
import { CornerTicks, DashedFrame } from "@/components/site/grid-lines";
import { Eyebrow } from "@/components/site/eyebrow";
import { StatusDot } from "@/components/site/status-pill";
import { SiteShell } from "@/components/site/kurumsal/site-shell";
import { GridPattern } from "@/components/site/kurumsal/grid-pattern";

export const metadata: Metadata = {
  title: "Hakkımızda",
  description:
    "KLEACORE, KLEAWORK DIGITAL LLC bünyesinde 2026'da kurulan alan adı, hosting, VDS sunucu ve SSL sağlayıcısıdır. Hikayemiz, misyonumuz ve değerlerimiz.",
  alternates: { canonical: "/hakkimizda" },
  openGraph: {
    title: "Hakkımızda | KLEACORE",
    description:
      "KLEAWORK DIGITAL LLC bünyesinde 2026'da kurulan KLEACORE'un hikayesi, misyonu ve değerleri.",
    url: "/hakkimizda",
  },
};

const facts: TrustBarItem[] = [
  { icon: CalendarDays, label: "2026", description: "Kuruluş yılı" },
  { icon: Building2, label: "KLEAWORK DIGITAL LLC", description: "Wyoming, ABD" },
  { icon: MapPin, label: "İstanbul", description: "Sunucu lokasyonu" },
  { icon: Headphones, label: "7/24 Destek", description: "Destek talebi ve e-posta" },
];

const companyRecord = [
  { label: "Unvan", value: "KLEAWORK DIGITAL LLC" },
  { label: "Marka", value: "KLEACORE" },
  { label: "Kuruluş", value: "2026 · Wyoming, ABD" },
  { label: "EIN", value: "36-5157418" },
  { label: "Adres", value: "30 N Gould St Ste R, Sheridan, WY 82801, USA" },
  { label: "Sunucu lokasyonu", value: "İstanbul" },
];

const milestones = [
  {
    period: "2026 · 1. çeyrek",
    title: "KLEACORE'un kuruluşu",
    description: "KLEAWORK DIGITAL LLC bünyesinde, modern hosting standartlarıyla yola çıktık.",
  },
  {
    period: "2026 · 1. çeyrek",
    title: "Altyapı lansmanı",
    description:
      "NVMe SSD ve LiteSpeed altyapısıyla hosting ve sunucu hizmetlerini yayına aldık.",
  },
  {
    period: "2026 · 2. çeyrek",
    title: "Müşteri paneli",
    description:
      "Alan adı, hosting ve sunucu yönetimini tek panelden sunan müşteri altyapısını devreye aldık.",
  },
  {
    period: "Hedef",
    title: "Güvenilir teknoloji ortağı",
    description:
      "Türkiye ve global pazarda güvenilir, hızlı ve şeffaf bir teknoloji ortağı olmayı hedefliyoruz.",
  },
];

const values: FeatureItem[] = [
  {
    icon: Lightbulb,
    title: "Yenilikçi yaklaşım",
    description:
      "2026'da, güncel altyapı ve yazılımlarla kurulduk; eski nesil sistemlerin yükünü taşımıyoruz.",
  },
  {
    icon: Zap,
    title: "Hız odaklılık",
    description:
      "Dijitalde zamanın ne kadar kıymetli olduğunu biliyoruz. Altyapımızı performans için yapılandırıyoruz.",
  },
  {
    icon: HeartHandshake,
    title: "Anlaşılır destek",
    description:
      "Karmaşık terimlerle değil, sizin dilinizden konuşan bir destek anlayışıyla yanınızdayız.",
  },
  {
    icon: Shield,
    title: "Güvenli altyapı",
    description:
      "Verilerinizin güvenliği için ücretsiz SSL, otomatik yedek ve güncel yazılım sürümleri kullanıyoruz.",
  },
];

const services = [
  { icon: Globe, title: "Alan adı", description: "Kayıt, transfer ve WHOIS sorgulama", href: "/domain/kayit" },
  { icon: Server, title: "Web hosting", description: "cPanel ve LiteSpeed ile Linux hosting", href: "/hosting/linux" },
  { icon: Server, title: "VDS sunucu", description: "NVMe SSD diskli sanal sunucular", href: "/sunucu/vds" },
  { icon: Lock, title: "SSL sertifikası", description: "DV, OV, EV ve wildcard sertifikalar", href: "/ssl/standart" },
];

export default function HakkimizdaPage() {
  return (
    <SiteShell>
      <PageHeader
        eyebrow="2026'da kuruldu"
        title="İşinizi dijitalde büyüten teknoloji ortağınız"
        description="Dijital dünyanın hızına ve dinamizmine uyum sağlamak amacıyla temellerimizi attık. Yalnızca bir yer sağlayıcı değil, işinizi dijitalde büyüten teknoloji ortağınız olmayı hedefliyoruz."
        breadcrumbs={[{ label: "Kurumsal" }, { label: "Hakkımızda" }]}
      />

      <TrustBar items={facts} bordered={false} />

      {/* Story */}
      <Section divider aria-labelledby="hikayemiz">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading id="hikayemiz" eyebrow="Hikayemiz" title="Kısa ama net bir başlangıç" />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                2026 yılında, dijital dünyanın hızına ve dinamizmine uyum sağlamak amacıyla
                temellerimizi attık. KLEACORE olarak, yalnızca bir yer sağlayıcı değil, işinizi
                dijitalde büyüten teknoloji ortağınız olmayı hedefliyoruz.
              </p>
              <p>
                Teknolojinin her saniye değiştiği bir çağda yerimizde saymıyoruz. Güncel donanım
                ve yazılım çözümlerini yakından takip ederek projelerinizi güncel bir altyapıda
                barındırıyoruz.
              </p>
              <p>
                Bizim için teknoloji karmaşıklık değil; size sunulan bir kolaylık ve hız demektir.
                Her adımda müşterilerimizin yanında olarak dijital başarılarına ortak olmayı
                amaçlıyoruz.
              </p>
            </div>
          </div>

          {/* Company record card */}
          <DashedFrame className="p-3 sm:p-4">
            <div className="relative overflow-hidden rounded-xl border bg-background shadow-sm">
              <GridPattern />
              <CornerTicks />
              <div className="relative flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-6">
                <Eyebrow>Şirket kaydı</Eyebrow>
                <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <StatusDot />
                  Aktif
                </span>
              </div>
              <div className="relative px-5 pb-2 pt-6 sm:px-6">
                <p className="text-3xl font-semibold tracking-tight sm:text-4xl">KLEACORE</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Alan adı · Hosting · VDS sunucu · SSL
                </p>
              </div>
              <dl className="relative divide-y px-5 pb-3 sm:px-6">
                {companyRecord.map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4"
                  >
                    <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground sm:pt-0.5">
                      {row.label}
                    </dt>
                    <dd className="text-sm font-medium">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </DashedFrame>
        </div>
      </Section>

      {/* Timeline */}
      <Section tone="muted" divider aria-labelledby="yolculugumuz">
        <SectionHeading
          id="yolculugumuz"
          eyebrow="Yolculuğumuz"
          title="2026'dan bugüne"
          description="KLEACORE'un kuruluşundan bu yana attığı adımlar."
          className="mb-12"
        />
        <ol className="relative grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {milestones.map((item, index) => (
            <li key={item.title} className="relative bg-background p-6 md:p-8">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-md border bg-muted/40 font-mono text-xs font-medium">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {item.period}
                </span>
              </div>
              <h3 className="mt-5 text-base font-medium tracking-tight">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Mission & vision */}
      <Section divider aria-labelledby="misyon-vizyon">
        <SectionHeading
          id="misyon-vizyon"
          eyebrow="Misyon ve vizyon"
          title="Neden buradayız?"
          align="center"
          className="mb-12"
        />
        <div className="grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-2">
          <article className="bg-background p-8 md:p-10">
            <span className="flex size-10 items-center justify-center rounded-lg border bg-muted/40">
              <Target aria-hidden className="size-5 text-foreground/80" />
            </span>
            <h3 className="mt-6 text-xl font-semibold tracking-tight">Misyonumuz</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              İşletmelerin dijital dönüşümüne güvenilir, yüksek performanslı ve modern altyapı
              çözümleriyle katkıda bulunmak. Karmaşıklığı basitleştirerek teknolojinin sunduğu
              kolaylık ve hızı deneyimlemenizi sağlamak.
            </p>
          </article>
          <article className="bg-background p-8 md:p-10">
            <span className="flex size-10 items-center justify-center rounded-lg border bg-muted/40">
              <Eye aria-hidden className="size-5 text-foreground/80" />
            </span>
            <h3 className="mt-6 text-xl font-semibold tracking-tight">Vizyonumuz</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Güncel donanım ve yazılım çözümlerini yakından takip ederek projelerinizi güncel
              altyapıda barındırmak. Yalnızca bir hizmet sağlayıcı değil, işinizi dijitalde
              büyüten gerçek bir teknoloji ortağı olmak.
            </p>
          </article>
        </div>
      </Section>

      {/* Values */}
      <Section tone="muted" divider aria-labelledby="degerlerimiz">
        <SectionHeading
          id="degerlerimiz"
          eyebrow="Değerlerimiz"
          title="Çalışma şeklimizi belirleyen ilkeler"
          className="mb-12"
        />
        <FeatureGrid items={values} columns={4} />
      </Section>

      {/* Services */}
      <Section divider aria-labelledby="hizmetlerimiz">
        <SectionHeading
          id="hizmetlerimiz"
          eyebrow="Hizmetlerimiz"
          title="Neler sunuyoruz?"
          description="Bir web projesinin ihtiyaç duyduğu temel hizmetleri tek panelden yönetin."
          className="mb-10"
        />
        <ul className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <li key={service.href} className="bg-background">
              <Link
                href={service.href}
                className="group flex h-full flex-col p-6 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:p-8"
              >
                <span className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg border bg-muted/40">
                    <service.icon aria-hidden className="size-5 text-foreground/80" />
                  </span>
                  <ArrowUpRight
                    aria-hidden
                    className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                  />
                </span>
                <span className="mt-5 text-base font-medium tracking-tight">{service.title}</span>
                <span className="mt-1.5 text-sm text-muted-foreground">{service.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand
        eyebrow="Tanışalım"
        title="Projeniz için doğru altyapıyı birlikte seçelim"
        description="Sorularınız için bize yazın; paket seçimi ve taşıma konusunda destek ekibimiz yardımcı olur."
        primary={{ label: "Bize ulaşın", href: "/iletisim" }}
        secondary={{ label: "Hosting paketleri", href: "/hosting/linux" }}
      />
    </SiteShell>
  );
}
