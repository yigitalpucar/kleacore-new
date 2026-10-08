import type { Metadata } from "next";
import Link from "next/link";
import { Code2, Download, KeyRound, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import { buttonClasses } from "@/components/site/button-classes";
import { SiteShell } from "@/components/site/kurumsal/site-shell";

export const metadata: Metadata = {
  title: "API Dokümantasyonu",
  description:
    "KLEACORE REST API v1: yetkilendirme, istek limitleri, TypeScript SDK ve fatura, hizmet, sipariş, alan adı ve destek talebi uç noktaları.",
  alternates: { canonical: "/api-docs" },
  openGraph: {
    title: "API Dokümantasyonu | KLEACORE",
    description: "KLEACORE API v1 ile hizmet, fatura ve destek işlemlerinizi otomatikleştirin.",
    url: "/api-docs",
  },
};

const endpointGroups = [
  {
    title: "Faturalar",
    endpoints: [
      { method: "GET", path: "/api/v1/invoices", description: "Fatura listesini getirir." },
      { method: "GET", path: "/api/v1/invoices/{id}", description: "Fatura detayını getirir." },
    ],
  },
  {
    title: "Hizmetler",
    endpoints: [
      { method: "GET", path: "/api/v1/services", description: "Müşteri hizmetlerini listeler." },
      { method: "GET", path: "/api/v1/services/{id}", description: "Hizmet detayını getirir." },
    ],
  },
  {
    title: "Siparişler",
    endpoints: [
      { method: "GET", path: "/api/v1/orders", description: "Müşteri siparişlerini listeler." },
      { method: "GET", path: "/api/v1/orders/{id}", description: "Sipariş detayını getirir." },
    ],
  },
  {
    title: "Alan adları",
    endpoints: [
      { method: "GET", path: "/api/v1/domains", description: "Müşteri alan adlarını listeler." },
      {
        method: "GET",
        path: "/api/v1/domains/{id}",
        description: "Alan adı detayını getirir (ID veya alan adı).",
      },
    ],
  },
  {
    title: "Destek talepleri",
    endpoints: [
      { method: "GET", path: "/api/v1/tickets", description: "Destek taleplerini listeler." },
      { method: "POST", path: "/api/v1/tickets", description: "Yeni destek talebi oluşturur." },
    ],
  },
];

const sdkExample = `import { KleacoreClient } from "@/lib/sdk/kleacore-client";

const client = new KleacoreClient(
  process.env.KLEACORE_API_KEY!,
  "https://kleacore.com/api/v1"
);

const { services } = await client.listServices({ status: "ACTIVE", page: 1 });
const { orders } = await client.listOrders({ perPage: 20 });
const { domains } = await client.listDomains();
const invoice = await client.getInvoice("clx123...");
const ticket = await client.createTicket({
  subject: "Entegrasyon sorusu",
  message: "API limitleri hakkında bilgi alabilir miyim?",
  department: "TECHNICAL",
});`;

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-14 shrink-0 items-center justify-center rounded border font-mono text-[11px] font-semibold tracking-[0.08em]",
        method === "GET" ? "bg-muted/60 text-foreground" : "border-foreground bg-foreground text-background"
      )}
    >
      {method}
    </span>
  );
}

const inlineCode = "rounded border bg-muted/60 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground";

export default function ApiDocsPage() {
  return (
    <SiteShell>
      <PageHeader
        eyebrow="API v1"
        title="KLEACORE API"
        description={
          <>
            Hizmet, fatura, sipariş, alan adı ve destek işlemlerinizi REST API ile otomatikleştirin.
            Ana adres: <span className="font-mono text-foreground">https://kleacore.com/api/v1</span>
          </>
        }
        breadcrumbs={[{ label: "API Dokümantasyonu" }]}
        actions={
          <Link href="/api/v1/openapi" className={buttonClasses({ variant: "outline" })} prefetch={false}>
            <Download aria-hidden className="size-4" />
            OpenAPI spesifikasyonu
          </Link>
        }
      />

      <Section aria-labelledby="baslangic">
        <SectionHeading id="baslangic" eyebrow="Başlangıç" title="Yetkilendirme ve SDK" className="mb-10" />
        <div className="grid gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-2">
          <div className="bg-background p-6 md:p-8">
            <h3 className="flex items-center gap-2 text-base font-medium">
              <KeyRound aria-hidden className="size-4 text-foreground/80" />
              Yetkilendirme
            </h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <li>
                Tüm isteklerde API anahtarı gönderilmelidir:{" "}
                <code className={inlineCode}>Authorization: Bearer kc_live_...</code> veya{" "}
                <code className={inlineCode}>x-api-key: kc_live_...</code>
              </li>
              <li>
                API anahtarlarını müşteri panelinden oluşturabilirsiniz:{" "}
                <code className={inlineCode}>/musteri/panel/ayarlar</code>
              </li>
              <li>
                İstek limiti (yeni uç noktalar):{" "}
                <span className="font-medium text-foreground">30 istek / 10 dakika</span> (API
                anahtarı başına)
              </li>
            </ul>
          </div>
          <div className="min-w-0 bg-background p-6 md:p-8">
            <h3 className="flex items-center gap-2 text-base font-medium">
              <Code2 aria-hidden className="size-4 text-foreground/80" />
              TypeScript SDK
            </h3>
            <p className="mt-4 text-sm text-muted-foreground">
              Projede hazır gelen istemci: <code className={inlineCode}>src/lib/sdk/kleacore-client.ts</code>
            </p>
            <pre className="dark mt-4 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-xs leading-relaxed text-neutral-200">
              <code>{sdkExample}</code>
            </pre>
          </div>
        </div>
      </Section>

      <Section tone="muted" divider aria-labelledby="uc-noktalar">
        <SectionHeading id="uc-noktalar" eyebrow="Referans" title="Uç noktalar" className="mb-10" />
        <div className="space-y-6">
          {endpointGroups.map((group) => (
            <div key={group.title} className="overflow-hidden rounded-xl border bg-background">
              <h3 className="border-b bg-muted/30 px-5 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {group.title}
              </h3>
              <ul className="divide-y">
                {group.endpoints.map((endpoint) => (
                  <li
                    key={`${endpoint.method}-${endpoint.path}`}
                    className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="flex min-w-0 items-center gap-3 sm:w-[22rem] sm:shrink-0">
                      <MethodBadge method={endpoint.method} />
                      <code className="break-all font-mono text-sm">{endpoint.path}</code>
                    </span>
                    <span className="text-sm text-muted-foreground">{endpoint.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div role="note" className="mt-8 flex items-start gap-3 rounded-xl border bg-background p-5 text-sm text-muted-foreground">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-foreground/80" />
          <p>
            Bu dokümantasyon temel entegrasyon akışını kapsar. Gerekirse destek ekibinden gelişmiş
            uç nokta listesi ve webhook rehberi talep edebilirsiniz.
          </p>
        </div>
      </Section>
    </SiteShell>
  );
}
