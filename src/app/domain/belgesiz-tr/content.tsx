"use client";

import { useState } from "react";
import { PageHero } from "@/components/sections/page-hero";
import { TrustStrip, domainTrustItems } from "@/components/sections/trust-strip";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { searchDomainAvailability } from "@/lib/actions/public/domains";
import { toast } from "@/lib/toast";
import { BorderBeam } from "@/components/magicui/border-beam";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Check,
  Search,
  Loader2,
  FileX,
  Zap,
  Clock,
  Shield,
  HeartHandshake,
  Globe,
} from "lucide-react";

interface BelgesizTld {
  ext: string;
  registerPrice: number;
  description: string;
}

interface BelgesizTRContentProps {
  tlds: BelgesizTld[];
}

const features = [
  {
    icon: FileX,
    title: "Belge Gerektirmez",
    description: "Kimlik veya şirket belgesi olmadan kayıt",
  },
  {
    icon: Zap,
    title: "Anında Aktivasyon",
    description: "Ödeme sonrası hemen aktif",
  },
  {
    icon: Clock,
    title: "Dakikalar İçinde",
    description: "Hızlı kayıt süreci",
  },
  {
    icon: Shield,
    title: "Türkiye Uzantısı",
    description: "Yerel güvenilirlik",
  },
];

export const BelgesizTRContent = ({ tlds }: BelgesizTRContentProps) => {
  const [domain, setDomain] = useState("");
  const [selectedTld, setSelectedTld] = useState(tlds[0]?.ext ?? ".gen.tr");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<null | {
    domain: string;
    available: boolean;
    price: number;
  }>(null);

  const handleSearch = async () => {
    if (!domain.trim()) return;

    setIsSearching(true);
    setResult(null);

    try {
      const response = await searchDomainAvailability(domain, [selectedTld]);
      if (!response.success || !response.data) {
        toast.error(response.error ?? "Domain sorgusu tamamlanamadı");
        return;
      }

      const firstResult = response.data.results[0];
      if (!firstResult) {
        toast.error("Sorgu sonucu alınamadı");
        return;
      }

      setResult({
        domain: firstResult.domain,
        available: firstResult.available,
        price: firstResult.price,
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <main className="flex-1">
      <PageHero
        badge="Belge Gerektirmez"
        badgeIcon={FileX}
        title="Belgesiz .TR Domain"
        description="Kimlik veya şirket belgesi olmadan Türkiye uzantılı domain kaydedin. Anında aktivasyon, uygun fiyat."
      >
        <Card className="max-w-2xl mx-auto relative overflow-hidden">
          <BorderBeam size={150} duration={10} />
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Input
                  placeholder="Domain adınız"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="pr-24"
                />
                <select
                  value={selectedTld}
                  onChange={(e) => setSelectedTld(e.target.value)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-2 rounded bg-muted border-0 text-sm focus:ring-0"
                >
                  {tlds.map((tld) => (
                    <option key={tld.ext} value={tld.ext}>
                      {tld.ext}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleSearch}
                disabled={isSearching || !domain.trim()}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Sorgula
                  </>
                )}
              </Button>
            </div>

            {result && (
              <div
                className={`mt-4 p-4 rounded-lg flex items-center justify-between ${
                  result.available
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-destructive/10 border border-destructive/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  {result.available ? (
                    <Check className="h-5 w-5 text-primary" />
                  ) : (
                    <FileX className="h-5 w-5 text-destructive" />
                  )}
                  <div>
                    <p className="font-semibold">{result.domain}</p>
                    <p className="text-sm text-muted-foreground">
                      {result.available
                        ? "Bu domain müsait!"
                        : "Bu domain alınmış"}
                    </p>
                  </div>
                </div>
                {result.available && (
                  <Button>₺{result.price} - Satın Al</Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </PageHero>

      <TrustStrip items={domainTrustItems} />

      <section className="py-12 md:py-16 border-b">
        <div className="container">
          <BlurFade delay={0.1} inView>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {features.map((feature) => (
                <div key={feature.title} className="text-center p-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-3">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-medium text-sm">{feature.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </BlurFade>
        </div>
      </section>

      {/* TLD Options */}
      <section className="py-16 md:py-24">
        <div className="container">
          <BlurFade delay={0.1} inView>
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Belgesiz .TR Uzantıları
              </h2>
              <p className="mt-4 text-muted-foreground">
                Tüm uzantılar aynı fiyat, belge gerektirmez
              </p>
            </div>
          </BlurFade>

          <BlurFade delay={0.2} inView>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
              {tlds.map((tld) => (
                <Card
                  key={tld.ext}
                  className="hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedTld(tld.ext)}
                >
                  <CardContent className="p-6 text-center">
                    <p className="text-2xl font-bold text-primary">{tld.ext}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {tld.description}
                    </p>
                    <p className="text-3xl font-bold mt-4">
                      ₺{tld.registerPrice}
                    </p>
                    <p className="text-xs text-muted-foreground">/yıl</p>
                    <Button className="w-full mt-4" variant="outline">
                      Kaydet
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </BlurFade>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container max-w-4xl">
          <BlurFade delay={0.1} inView>
            <h2 className="text-3xl font-bold tracking-tight text-center mb-10">
              Belgeli vs Belgesiz Karşılaştırma
            </h2>
          </BlurFade>

          <BlurFade delay={0.2} inView>
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Belgeli .TR Uzantıları</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      .com.tr, .net.tr, .org.tr
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground">
                      Kimlik/Vergi levhası gerekli
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground">
                      1-2 iş günü aktivasyon
                    </li>
                    <li className="flex items-center gap-2 text-muted-foreground">
                      Daha kurumsal görünüm
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Belgesiz .TR Uzantıları
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                      Önerilen
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      .gen.tr, .web.tr, .tv.tr
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Belge gerektirmez
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Anında aktivasyon
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      Uygun fiyat: ₺{tlds[0]?.registerPrice ?? 79}/yıl
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </BlurFade>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 md:py-24">
        <div className="container">
          <BlurFade delay={0.1} inView>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Neden KLEACORE?
              </h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                Belgesiz .TR domain kaydında güvenilir çözüm ortağınız
              </p>
            </div>
          </BlurFade>

          <BlurFade delay={0.2} inView>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="text-center p-6 rounded-xl bg-card border">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <FileX className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Belge Gerektirmez</h3>
                <p className="text-sm text-muted-foreground">
                  Kimlik veya şirket belgesi olmadan kayıt
                </p>
              </div>
              <div className="text-center p-6 rounded-xl bg-card border">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
                  <Zap className="h-7 w-7 text-green-500" />
                </div>
                <h3 className="font-semibold mb-2">Anında Aktivasyon</h3>
                <p className="text-sm text-muted-foreground">
                  Ödeme sonrası domain hemen aktif olur
                </p>
              </div>
              <div className="text-center p-6 rounded-xl bg-card border">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10">
                  <Globe className="h-7 w-7 text-blue-500" />
                </div>
                <h3 className="font-semibold mb-2">Türkiye Uzantısı</h3>
                <p className="text-sm text-muted-foreground">
                  .TR ile yerel güvenilirlik sağlayın
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
                `Uygun fiyat: ₺${tlds[0]?.registerPrice ?? 79}/yıl`,
                "Kolay DNS yönetimi",
                "Ücretsiz WHOIS gizliliği",
                "Otomatik yenileme",
                "E-posta yönlendirme",
                "Domain kilitleme",
                "Hızlı kayıt süreci",
                "Güvenli ödeme",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border"
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
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container">
          <BlurFade delay={0.1} inView>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Sıkça Sorulan Sorular
              </h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                Belgesiz .TR domain hakkında merak edilenler
              </p>
            </div>
          </BlurFade>

          <BlurFade delay={0.2} inView>
            <div className="max-w-3xl mx-auto">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>
                    Belgesiz .TR domain nedir?
                  </AccordionTrigger>
                  <AccordionContent>
                    Belgesiz .TR domainler (.gen.tr, .web.tr, .tv.tr vb.),
                    kimlik veya şirket belgesi gerektirmeden
                    kaydedebileceğiniz Türkiye uzantılı alan adlarıdır.
                    Normal .com.tr, .net.tr gibi uzantıların aksine herhangi
                    bir evrak yüklemeden anında kayıt yapabilirsiniz.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>
                    Hangi uzantılar belge gerektirmez?
                  </AccordionTrigger>
                  <AccordionContent>
                    .gen.tr, .web.tr, .tv.tr, .name.tr, .info.tr ve .bbs.tr
                    uzantıları belge gerektirmez. Bu uzantıları herkes kimlik
                    veya şirket belgesi olmadan kaydedebilir.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>
                    Kayıt işlemi ne kadar sürer?
                  </AccordionTrigger>
                  <AccordionContent>
                    Belgesiz .TR domain kayıtları anında gerçekleşir.
                    Ödemenizi tamamladıktan sonra domain adınız hemen aktif
                    hale gelir ve kullanmaya başlayabilirsiniz. Belgeli
                    uzantıların aksine bekleme süresi yoktur.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4">
                  <AccordionTrigger>
                    Belgesiz ve belgeli uzantılar arasındaki fark nedir?
                  </AccordionTrigger>
                  <AccordionContent>
                    Belgeli uzantılar (.com.tr, .net.tr, .org.tr) için kimlik
                    veya vergi levhası gerekir ve aktivasyon 1-2 iş günü
                    sürer. Belgesiz uzantılar ise anında aktif olur ve evrak
                    gerektirmez. Fonksiyonel olarak ikisi de aynı şekilde
                    çalışır.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-5">
                  <AccordionTrigger>
                    SEO açısından bir fark var mı?
                  </AccordionTrigger>
                  <AccordionContent>
                    Hayır, arama motorları açısından belgeli veya belgesiz .TR
                    uzantıları arasında bir fark yoktur. Her iki uzantı türü
                    de Türkiye odaklı aramalarda yerel avantaj sağlar. Önemli
                    olan domain yaşı ve içerik kalitesidir.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-6">
                  <AccordionTrigger>
                    Yabancı uyruklu kişiler kaydedebilir mi?
                  </AccordionTrigger>
                  <AccordionContent>
                    Evet, belgesiz .TR domainleri herkes kaydedebilir. Türk
                    vatandaşı olmanız veya Türkiye&apos;de şirketinizin olması
                    gerekmez. Yurt dışından da rahatlıkla kayıt yapabilirsiniz.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-7">
                  <AccordionTrigger>
                    Domain süresini uzatabilir miyim?
                  </AccordionTrigger>
                  <AccordionContent>
                    Evet, belgesiz .TR domainleri diğer domainler gibi
                    yenilenebilir. Süresi dolmadan önce otomatik yenileme
                    özelliğini aktif edebilir veya manuel olarak
                    uzatabilirsiniz. Yenileme ücreti kayıt ücreti ile
                    aynıdır.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-8">
                  <AccordionTrigger>
                    Hangi uzantıyı tercih etmeliyim?
                  </AccordionTrigger>
                  <AccordionContent>
                    .gen.tr genel kullanım için en popüler seçenektir. Web
                    projeleri için .web.tr, kişisel siteler için .name.tr,
                    medya ve yayıncılık için .tv.tr tercih edilebilir. Hepsi
                    aynı fiyattır, projenize en uygun olanı seçebilirsiniz.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </BlurFade>
        </div>
      </section>
    </main>
  );
};
