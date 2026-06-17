import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { DomainSearch } from "@/components/domain/domain-search";
import { TldPricing } from "@/components/domain/tld-pricing";
import { BlurFade } from "@/components/magicui/blur-fade";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Check, Shield, Clock, Headphones, Globe, Zap, Lock, HeartHandshake } from "lucide-react";
import { getDomainTlds } from "@/lib/dal/domain-tlds";

export const dynamic = "force-dynamic";

const features = [
  {
    icon: Shield,
    title: "Ücretsiz WHOIS Gizlilik",
    description: "Kişisel bilgileriniz korunur",
  },
  {
    icon: Clock,
    title: "Anında Aktivasyon",
    description: "Domain hemen aktif olur",
  },
  {
    icon: Headphones,
    title: "7/24 Destek",
    description: "Her zaman yanınızdayız",
  },
];

export default async function DomainKayitPage() {
  const tlds = await getDomainTlds();

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
                  Domain Kaydı
                </h1>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                  500+ uzantı arasından hayalinizdeki domain adını bulun ve
                  kaydedin. Hemen arama yapın!
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <div className="max-w-4xl mx-auto">
                <DomainSearch
                  tlds={tlds.slice(0, 12).map((tld) => ({
                    ext: tld.ext,
                    price: tld.registerPrice,
                    renewPrice: tld.renewPrice,
                  }))}
                />
              </div>
            </BlurFade>

            {/* Features */}
            <BlurFade delay={0.3} inView>
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="flex items-center gap-3 text-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{feature.title}</p>
                      <p className="text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </BlurFade>
          </div>
        </section>

        {/* TLD Pricing */}
        <section className="py-16 md:py-24">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Tüm Domain Uzantıları
                </h2>
                <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                  Popüler uzantılardan özel TLD&apos;lere kadar geniş seçenek.
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <TldPricing tlds={tlds} />
            </BlurFade>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Neden KLEACORE?
                </h2>
                <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                  Domain kaydında güvenilir çözüm ortağınız
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
                <div className="text-center p-6 rounded-xl bg-card border">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Globe className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">500+ Uzantı</h3>
                  <p className="text-sm text-muted-foreground">
                    .com, .net, .org ve daha yüzlerce TLD seçeneği
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
                    <Lock className="h-7 w-7 text-blue-500" />
                  </div>
                  <h3 className="font-semibold mb-2">WHOIS Gizliliği</h3>
                  <p className="text-sm text-muted-foreground">
                    Kişisel bilgileriniz ücretsiz korunur
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
                  "Rekabetçi fiyatlar",
                  "Kolay DNS yönetimi",
                  "Otomatik yenileme",
                  "Ücretsiz e-posta yönlendirme",
                  "Domain kilitleme",
                  "Transfer kolaylığı",
                  "SSL sertifikası desteği",
                  "Toplu domain yönetimi",
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
                  Domain kaydı hakkında merak edilenler
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <div className="max-w-3xl mx-auto">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>Domain nedir?</AccordionTrigger>
                    <AccordionContent>
                      Domain (alan adı), web sitenizin internet üzerindeki adresidir.
                      Örneğin, &quot;kleacore.com&quot; bir domain adıdır. Kullanıcılar bu adresi
                      tarayıcılarına yazarak web sitenize ulaşabilirler.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger>Domain kaydı ne kadar sürer?</AccordionTrigger>
                    <AccordionContent>
                      Domain kaydı anında gerçekleşir. Ödemenizi tamamladıktan sonra
                      domain adınız hemen aktif hale gelir ve DNS ayarlarını yapılandırmaya
                      başlayabilirsiniz.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-3">
                    <AccordionTrigger>WHOIS gizliliği nedir?</AccordionTrigger>
                    <AccordionContent>
                      WHOIS, domain sahipliği bilgilerinin tutulduğu bir veritabanıdır.
                      WHOIS gizliliği ile kişisel bilgileriniz (ad, adres, telefon, e-posta)
                      herkese açık olmaktan korunur. KLEACORE&apos;da bu hizmet ücretsizdir.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-4">
                    <AccordionTrigger>Domain transferi nasıl yapılır?</AccordionTrigger>
                    <AccordionContent>
                      Mevcut domain adınızı KLEACORE&apos;a transfer etmek için önce mevcut
                      kayıt firmanızdan transfer kodunu (EPP/Auth Code) almanız gerekir.
                      Ardından transfer sayfamızdan işlemi başlatabilirsiniz. Transfer
                      genellikle 5-7 gün içinde tamamlanır.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-5">
                    <AccordionTrigger>Domain süresi dolunca ne olur?</AccordionTrigger>
                    <AccordionContent>
                      Domain süreniz dolduğunda, genellikle 30-45 günlük bir yenileme
                      süresi tanınır. Bu süre içinde yenilemezseniz domain askıya alınır
                      ve ardından serbest bırakılarak başkaları tarafından kaydedilebilir
                      hale gelir. Otomatik yenileme özelliğimizle bu riski ortadan kaldırabilirsiniz.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-6">
                    <AccordionTrigger>Hangi uzantıyı seçmeliyim?</AccordionTrigger>
                    <AccordionContent>
                      Uzantı seçimi projenize bağlıdır. Genel kullanım için .com en popüler
                      seçenektir. Türkiye odaklı projeler için .com.tr, teknoloji projeleri
                      için .io veya .tech, kişisel siteler için .me tercih edilebilir.
                      Marka koruması için birden fazla uzantı almanızı öneririz.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-7">
                    <AccordionTrigger>DNS ayarları nasıl yapılır?</AccordionTrigger>
                    <AccordionContent>
                      Domain kaydınız tamamlandıktan sonra kontrol panelinizden DNS
                      ayarlarını kolayca yapabilirsiniz. A kaydı, CNAME, MX ve TXT
                      kayıtlarını ekleyebilir, nameserver değişikliği yapabilirsiniz.
                      İhtiyaç duyarsanız 7/24 teknik destek ekibimiz size yardımcı olabilir.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-8">
                    <AccordionTrigger>Birden fazla domain alabilir miyim?</AccordionTrigger>
                    <AccordionContent>
                      Evet, istediğiniz kadar domain kaydedebilirsiniz. Toplu domain
                      yönetim panelimiz sayesinde tüm domainlerinizi tek bir yerden
                      kolayca yönetebilirsiniz. Çoklu domain alımlarında özel indirimler
                      de sunmaktayız.
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
