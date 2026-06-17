import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { KeyRound, Globe, ShieldCheck, Download, Code2 } from "lucide-react";

const endpointGroups = [
  {
    title: "Faturalar",
    endpoints: [
      { method: "GET", path: "/api/v1/invoices", description: "Fatura listesini getirir." },
      { method: "GET", path: "/api/v1/invoices/{id}", description: "Fatura detayini getirir." },
    ],
  },
  {
    title: "Hizmetler",
    endpoints: [
      { method: "GET", path: "/api/v1/services", description: "Musteri hizmetlerini listeler." },
      { method: "GET", path: "/api/v1/services/{id}", description: "Hizmet detayini getirir." },
    ],
  },
  {
    title: "Siparisler",
    endpoints: [
      { method: "GET", path: "/api/v1/orders", description: "Musteri siparislerini listeler." },
      { method: "GET", path: "/api/v1/orders/{id}", description: "Siparis detayini getirir." },
    ],
  },
  {
    title: "Domainler",
    endpoints: [
      { method: "GET", path: "/api/v1/domains", description: "Musteri domainlerini listeler." },
      {
        method: "GET",
        path: "/api/v1/domains/{id}",
        description: "Domain detayini getirir (ID veya domain adi).",
      },
    ],
  },
  {
    title: "Destek Talepleri",
    endpoints: [
      { method: "GET", path: "/api/v1/tickets", description: "Destek taleplerini listeler." },
      { method: "POST", path: "/api/v1/tickets", description: "Yeni destek talebi olusturur." },
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
  message: "API limitleri hakkinda bilgi alabilir miyim?",
  department: "TECHNICAL",
});`;

function methodBadgeClass(method: string) {
  switch (method) {
    case "GET":
      return "bg-blue-500/10 text-blue-600 border-blue-500/30";
    case "POST":
      return "bg-green-500/10 text-green-600 border-green-500/30";
    case "PUT":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30";
    case "DELETE":
      return "bg-red-500/10 text-red-600 border-red-500/30";
    default:
      return "bg-zinc-500/10 text-zinc-600 border-zinc-500/30";
  }
}

export default function ApiDocsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1">
        <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="max-w-3xl mx-auto text-center mb-10">
                <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm font-medium mb-4">
                  <Globe className="h-4 w-4 text-primary" />
                  API Dokumantasyonu
                </div>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                  KLEACORE API v1
                </h1>
                <p className="mt-4 text-muted-foreground">
                  API ana adresi: <span className="font-mono">https://kleacore.com/api/v1</span>
                </p>
              </div>
            </BlurFade>

            <div className="max-w-4xl mx-auto space-y-6">
              <BlurFade delay={0.15} inView>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <KeyRound className="h-5 w-5 text-primary" />
                      Yetkilendirme
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Tum isteklerde API anahtari gonderilmelidir:{" "}
                      <span className="font-mono">Authorization: Bearer kc_live_...</span> veya{" "}
                      <span className="font-mono">x-api-key: kc_live_...</span>
                    </p>
                    <p>
                      API anahtarlarini musteri panelinden olusturabilirsiniz:{" "}
                      <span className="font-mono">/musteri/panel/ayarlar</span>
                    </p>
                    <p>
                      Rate limit (yeni endpointler):{" "}
                      <span className="font-medium text-foreground">30 istek / 10 dakika</span>{" "}
                      (API anahtari basina)
                    </p>
                    <p>
                      OpenAPI spesifikasyonu:{" "}
                      <Link
                        href="/api/v1/openapi"
                        className="font-mono text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <Download className="h-3.5 w-3.5" />
                        /api/v1/openapi
                      </Link>
                    </p>
                  </CardContent>
                </Card>
              </BlurFade>

              <BlurFade delay={0.18} inView>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code2 className="h-5 w-5 text-primary" />
                      TypeScript SDK
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Projede hazir gelen istemci:{" "}
                      <span className="font-mono">src/lib/sdk/kleacore-client.ts</span>
                    </p>
                    <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed">
                      <code>{sdkExample}</code>
                    </pre>
                  </CardContent>
                </Card>
              </BlurFade>

              {endpointGroups.map((group, groupIndex) => (
                <BlurFade key={group.title} delay={0.2 + groupIndex * 0.05} inView>
                  <Card>
                    <CardHeader>
                      <CardTitle>{group.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {group.endpoints.map((endpoint) => (
                        <div
                          key={`${endpoint.method}-${endpoint.path}`}
                          className="rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
                        >
                          <Badge className={`border w-fit ${methodBadgeClass(endpoint.method)}`}>
                            {endpoint.method}
                          </Badge>
                          <div className="space-y-1">
                            <p className="font-mono text-sm">{endpoint.path}</p>
                            <p className="text-sm text-muted-foreground">
                              {endpoint.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </BlurFade>
              ))}

              <BlurFade delay={0.35} inView>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      Not
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Bu dokumantasyon temel entegrasyon akisini kapsar. Gerekirse destek ekibinden
                    gelismis endpoint listesi ve webhook rehberi talep edebilirsiniz.
                  </CardContent>
                </Card>
              </BlurFade>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
