import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Globe, ShieldCheck } from "lucide-react";

const endpointGroups = [
  {
    title: "Kimlik Dogrulama",
    endpoints: [
      { method: "POST", path: "/auth/token", description: "API token olusturur." },
      { method: "POST", path: "/auth/refresh", description: "Token yeniler." },
    ],
  },
  {
    title: "Faturalar",
    endpoints: [
      { method: "GET", path: "/invoices", description: "Fatura listesini getirir." },
      { method: "GET", path: "/invoices/{id}", description: "Fatura detayini getirir." },
      { method: "POST", path: "/invoices/{id}/pay", description: "Fatura odeme islemini baslatir." },
    ],
  },
  {
    title: "Destek Talepleri",
    endpoints: [
      { method: "GET", path: "/tickets", description: "Destek taleplerini listeler." },
      { method: "POST", path: "/tickets", description: "Yeni destek talebi olusturur." },
      { method: "POST", path: "/tickets/{id}/reply", description: "Destek talebine yanit ekler." },
    ],
  },
];

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
                  API ana adresi: <span className="font-mono">https://api.kleacore.com/v1</span>
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
                      Tum isteklerde <span className="font-mono">Authorization: Bearer {"{TOKEN}"}</span> basligi gonderilmelidir.
                    </p>
                    <p>
                      Rate limit: <span className="font-medium text-foreground">1000 istek/dakika</span>
                    </p>
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
