"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { lookupWhois } from "@/lib/actions/public/domains";
import { toast } from "@/lib/toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  Loader2,
  User,
  Building,
  Calendar,
  Server,
  Globe,
  Mail,
  RefreshCw,
  Check,
  Shield,
  Zap,
  HeartHandshake,
  Lock,
} from "lucide-react";

interface WhoisData {
  domain: string;
  registrar: string;
  registrant: string;
  createdDate: string;
  expiryDate: string;
  updatedDate: string;
  status: string[];
  nameServers: string[];
  dnssec: string;
}

function WhoisPageContent() {
  const searchParams = useSearchParams();
  const [domain, setDomain] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<WhoisData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runLookup = useCallback(async (query: string) => {
    const normalized = query.trim();
    if (!normalized) return;

    setIsSearching(true);
    setResult(null);
    setError(null);

    try {
      const response = await lookupWhois(normalized);
      if (!response.success || !response.data) {
        const message =
          response.error ?? "WHOIS kaydı bulunamadı veya sorgu tamamlanamadı";
        setError(message);
        toast.error(message);
        return;
      }
      setResult(response.data);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const param = searchParams.get("domain")?.trim();
    if (!param) return;
    setDomain(param);
    void runLookup(param);
  }, [searchParams, runLookup]);

  const handleSearch = async () => {
    await runLookup(domain);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-10">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                  WHOIS Sorgulama
                </h1>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                  Domain sahiplik bilgilerini, kayıt tarihini ve nameserver
                  bilgilerini öğrenin.
                </p>
              </div>
            </BlurFade>

            {/* Search */}
            <BlurFade delay={0.2} inView>
              <div className="max-w-2xl mx-auto">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Globe className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Domain adı girin (örn: example.com)"
                      className="h-14 pl-12 text-lg"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                  </div>
                  <Button
                    size="lg"
                    className="h-14 px-8"
                    onClick={handleSearch}
                    disabled={isSearching || !domain.trim()}
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Sorgulanıyor...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-5 w-5" />
                        Sorgula
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </BlurFade>
          </div>
        </section>

        {/* Results */}
        {(result || error) && (
          <section className="py-12">
            <div className="container max-w-4xl">
              <BlurFade delay={0.1} inView>
                {error ? (
                  <Card className="border-red-500/50 bg-red-500/5">
                    <CardContent className="p-6 text-center">
                      <p className="text-red-600">{error}</p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => {
                          setError(null);
                          setDomain("");
                        }}
                      >
                        Yeni Sorgu
                      </Button>
                    </CardContent>
                  </Card>
                ) : result ? (
                  <div className="space-y-6">
                    {/* Domain Header */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                          <Globe className="h-6 w-6 text-primary" />
                          {result.domain}
                        </CardTitle>
                      </CardHeader>
                    </Card>

                    {/* Info Grid */}
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Registrar Info */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Building className="h-5 w-5 text-primary" />
                            Kayıt Bilgileri
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Kayıt Firması
                            </p>
                            <p className="font-medium">{result.registrar}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Domain Sahibi
                            </p>
                            <p className="font-medium">{result.registrant}</p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Dates */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            Tarihler
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Kayıt Tarihi
                            </p>
                            <p className="font-medium">
                              {formatDate(result.createdDate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Bitiş Tarihi
                            </p>
                            <p className="font-medium">
                              {formatDate(result.expiryDate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Son Güncelleme
                            </p>
                            <p className="font-medium">
                              {formatDate(result.updatedDate)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Name Servers */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Server className="h-5 w-5 text-primary" />
                            Name Servers
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {result.nameServers.map((ns) => (
                              <li
                                key={ns}
                                className="font-mono text-sm bg-muted px-3 py-2 rounded"
                              >
                                {ns}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>

                      {/* Status */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <RefreshCw className="h-5 w-5 text-primary" />
                            Durum
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {result.status.map((status) => (
                              <div
                                key={status}
                                className="text-sm bg-green-500/10 text-green-600 px-3 py-2 rounded"
                              >
                                {status}
                              </div>
                            ))}
                            <div className="text-sm bg-muted px-3 py-2 rounded">
                              DNSSEC: {result.dnssec}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-4 justify-center">
                      <Button variant="outline" onClick={() => setResult(null)}>
                        Yeni Sorgu
                      </Button>
                      <Button>Bu Domaini Transfer Et</Button>
                    </div>
                  </div>
                ) : null}
              </BlurFade>
            </div>
          </section>
        )}

        {/* Info Section */}
        {!result && !error && (
          <section className="py-16 md:py-24">
            <div className="container max-w-4xl">
              <BlurFade delay={0.1} inView>
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-bold tracking-tight">
                    WHOIS Nedir?
                  </h2>
                </div>
              </BlurFade>

              <BlurFade delay={0.2} inView>
                <div className="prose prose-gray dark:prose-invert max-w-none">
                  <p className="text-muted-foreground text-center mb-8">
                    WHOIS, domain adlarının kayıt bilgilerini sorgulamamızı
                    sağlayan bir protokoldür. Bu sorgu ile bir domainin kime ait
                    olduğunu, ne zaman kayıt edildiğini ve ne zaman sona
                    ereceğini öğrenebilirsiniz.
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-3 mt-8">
                  <Card>
                    <CardContent className="p-6 text-center">
                      <User className="h-10 w-10 text-primary mx-auto mb-4" />
                      <h3 className="font-semibold mb-2">Sahiplik Bilgisi</h3>
                      <p className="text-sm text-muted-foreground">
                        Domain sahibinin iletişim bilgileri (gizlilik koruması
                        yoksa)
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Calendar className="h-10 w-10 text-primary mx-auto mb-4" />
                      <h3 className="font-semibold mb-2">Kayıt Tarihleri</h3>
                      <p className="text-sm text-muted-foreground">
                        Domainin ne zaman alındığı ve ne zaman biteceği
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Server className="h-10 w-10 text-primary mx-auto mb-4" />
                      <h3 className="font-semibold mb-2">DNS Bilgileri</h3>
                      <p className="text-sm text-muted-foreground">
                        Nameserver ve teknik yapılandırma bilgileri
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </BlurFade>
            </div>
          </section>
        )}

        {/* Why Choose Us */}
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Neden KLEACORE?
                </h2>
                <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                  Domain hizmetlerinde güvenilir çözüm ortağınız
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
                <div className="text-center p-6 rounded-xl bg-card border">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Search className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Hızlı Sorgulama</h3>
                  <p className="text-sm text-muted-foreground">
                    Anlık WHOIS sorgu sonuçları
                  </p>
                </div>
                <div className="text-center p-6 rounded-xl bg-card border">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
                    <Shield className="h-7 w-7 text-green-500" />
                  </div>
                  <h3 className="font-semibold mb-2">WHOIS Gizliliği</h3>
                  <p className="text-sm text-muted-foreground">
                    Ücretsiz gizlilik koruması
                  </p>
                </div>
                <div className="text-center p-6 rounded-xl bg-card border">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10">
                    <Globe className="h-7 w-7 text-blue-500" />
                  </div>
                  <h3 className="font-semibold mb-2">500+ Uzantı</h3>
                  <p className="text-sm text-muted-foreground">
                    Tüm popüler TLD&apos;ler desteklenir
                  </p>
                </div>
                <div className="text-center p-6 rounded-xl bg-card border">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/10">
                    <HeartHandshake className="h-7 w-7 text-purple-500" />
                  </div>
                  <h3 className="font-semibold mb-2">7/24 Destek</h3>
                  <p className="text-sm text-muted-foreground">
                    Uzman ekibimiz her zaman yanınızda
                  </p>
                </div>
              </div>
            </BlurFade>

            <BlurFade delay={0.3} inView>
              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  "Detaylı sorgu sonuçları",
                  "Kolay domain transfer",
                  "Rekabetçi fiyatlar",
                  "Anında aktivasyon",
                  "DNS yönetimi",
                  "Otomatik yenileme",
                  "E-posta yönlendirme",
                  "Güvenli ödeme",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 p-3 rounded-lg bg-background border"
                  >
                    <Check className="h-5 w-5 text-green-500 shrink-0" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </BlurFade>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 md:py-24">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Sıkça Sorulan Sorular
                </h2>
                <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                  WHOIS sorgulama hakkında merak edilenler
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <div className="max-w-3xl mx-auto">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>WHOIS nedir?</AccordionTrigger>
                    <AccordionContent>
                      WHOIS, domain adlarının kayıt bilgilerini sorgulamaya yarayan bir
                      protokoldür. Bu sorgu ile bir domainin kime ait olduğunu, hangi
                      kayıt firması tarafından yönetildiğini, kayıt ve bitiş tarihlerini,
                      nameserver bilgilerini öğrenebilirsiniz.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger>WHOIS sorgusu ücretsiz mi?</AccordionTrigger>
                    <AccordionContent>
                      Evet, KLEACORE üzerinden WHOIS sorgulaması tamamen ücretsizdir.
                      Dilediğiniz kadar sorgu yapabilirsiniz. Herhangi bir üyelik veya
                      ödeme gerektirmez.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-3">
                    <AccordionTrigger>WHOIS gizliliği nedir?</AccordionTrigger>
                    <AccordionContent>
                      WHOIS gizliliği, domain sahibinin kişisel bilgilerinin (ad, adres,
                      telefon, e-posta) WHOIS sorgularında görünmesini engelleyen bir
                      hizmettir. KLEACORE&apos;da bu hizmet tüm domainler için ücretsizdir
                      ve kişisel bilgileriniz &quot;REDACTED FOR PRIVACY&quot; olarak görünür.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-4">
                    <AccordionTrigger>Neden bazı bilgiler gizli görünüyor?</AccordionTrigger>
                    <AccordionContent>
                      GDPR ve diğer gizlilik düzenlemeleri nedeniyle, birçok kayıt firması
                      domain sahiplerinin kişisel bilgilerini varsayılan olarak gizler.
                      Bu nedenle sorgularda &quot;REDACTED FOR PRIVACY&quot; veya benzeri ifadeler
                      görebilirsiniz.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-5">
                    <AccordionTrigger>Domain müsait mi nasıl anlarım?</AccordionTrigger>
                    <AccordionContent>
                      WHOIS sorgusu yaptığınızda &quot;Domain kayıtlı değil&quot; veya benzeri bir
                      mesaj alırsanız, domain müsait olabilir. Kesin sonuç için domain
                      kayıt sayfamızdan sorgulama yapmanızı öneririz.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-6">
                    <AccordionTrigger>Nameserver nedir?</AccordionTrigger>
                    <AccordionContent>
                      Nameserver (NS), domainin DNS kayıtlarını barındıran sunuculardır.
                      Bir domain adresine erişildiğinde, nameserver&apos;lar o domainin hangi
                      IP adresine yönlendirileceğini belirler. WHOIS sorgusunda genellikle
                      ns1 ve ns2 şeklinde iki nameserver görürsünüz.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-7">
                    <AccordionTrigger>Domain durumu ne anlama gelir?</AccordionTrigger>
                    <AccordionContent>
                      Domain durumları (status), domainin mevcut halini gösterir.
                      &quot;clientTransferProhibited&quot; transfer kilidini, &quot;clientDeleteProhibited&quot;
                      silme korumasını, &quot;ok&quot; normal durumu ifade eder. Bu durumlar domainin
                      güvenlik ayarlarını yansıtır.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-8">
                    <AccordionTrigger>Bir domaini nasıl transfer edebilirim?</AccordionTrigger>
                    <AccordionContent>
                      WHOIS sorgusunda gördüğünüz bir domaini transfer etmek için, önce
                      mevcut kayıt firmasından EPP/Auth kodunu almanız gerekir. Ardından
                      domain transfer sayfamızdan işlemi başlatabilirsiniz. KLEACORE&apos;a
                      transfer edilen her domain için +1 yıl uzatma hediye edilir.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </BlurFade>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default function WhoisPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <WhoisPageContent />
    </Suspense>
  );
}
