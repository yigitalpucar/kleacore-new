import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BlurFade } from "@/components/magicui/blur-fade";
import { DomainTransferForm } from "@/components/domain/domain-transfer-form";
import { isAutomatedDomainTransferAvailable } from "@/lib/actions/customer/domain-transfer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Check,
  RefreshCw,
  Shield,
  Clock,
  Gift,
  Zap,
  HeartHandshake,
  Lock,
} from "lucide-react";

export const dynamic = "force-dynamic";

const transferSteps = [
  {
    step: 1,
    title: "Domain Kilidini Aç",
    description:
      "Mevcut sağlayıcınızdan domain kilidini açın ve EPP/Auth kodunu alın.",
  },
  {
    step: 2,
    title: "Transfer Başlat",
    description: "Domain adınızı ve EPP kodunu girerek transfer sürecini başlatın.",
  },
  {
    step: 3,
    title: "E-posta Onayı",
    description: "Domain sahibi e-posta adresine gelen onay linkine tıklayın.",
  },
  {
    step: 4,
    title: "Tamamlandı",
    description: "Transfer 5-7 gün içinde tamamlanır. +1 yıl uzatma hediye!",
  },
];

const benefits = [
  {
    icon: Gift,
    title: "+1 Yıl Ücretsiz Uzatma",
    description: "Her transferde domain süreniz 1 yıl uzar",
  },
  {
    icon: Shield,
    title: "Ücretsiz WHOIS Gizliliği",
    description: "Kişisel bilgileriniz korunsun",
  },
  {
    icon: Clock,
    title: "Hızlı Transfer",
    description: "Ortalama 5-7 gün içinde tamamlanır",
  },
];

export default async function DomainTransferPage() {
  const transferStatus = await isAutomatedDomainTransferAvailable();

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
                  Domain Transferi
                </h1>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                  Domaininizi bize transfer edin, +1 yıl ücretsiz uzatma kazanın.
                  Hızlı ve güvenli transfer süreci.
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <DomainTransferForm
                isLoggedIn={transferStatus.isLoggedIn}
                isAutomatedTransferAvailable={transferStatus.isAutomatedTransferAvailable}
              />
            </BlurFade>

            {/* Benefits */}
            <BlurFade delay={0.3} inView>
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {benefits.map((benefit) => (
                  <div
                    key={benefit.title}
                    className="flex items-start gap-3 p-4 rounded-lg bg-card border"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <benefit.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{benefit.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </BlurFade>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 md:py-24">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Transfer Nasıl Çalışır?
                </h2>
              </div>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <div className="grid gap-8 md:grid-cols-4 max-w-5xl mx-auto">
                {transferSteps.map((item, idx) => (
                  <div key={item.step} className="relative">
                    {idx < transferSteps.length - 1 && (
                      <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-border" />
                    )}
                    <div className="text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                        {item.step}
                      </div>
                      <h3 className="mt-4 font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
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
                  Domain transferinde güvenilir çözüm ortağınız
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
                <div className="text-center p-6 rounded-xl bg-card border">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Gift className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">+1 Yıl Hediye</h3>
                  <p className="text-sm text-muted-foreground">
                    Her transferde domain süreniz 1 yıl uzar
                  </p>
                </div>
                <div className="text-center p-6 rounded-xl bg-card border">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
                    <Zap className="h-7 w-7 text-green-500" />
                  </div>
                  <h3 className="font-semibold mb-2">Hızlı Transfer</h3>
                  <p className="text-sm text-muted-foreground">
                    5-7 gün içinde tamamlanan süreç
                  </p>
                </div>
                <div className="text-center p-6 rounded-xl bg-card border">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10">
                    <Lock className="h-7 w-7 text-blue-500" />
                  </div>
                  <h3 className="font-semibold mb-2">Güvenli İşlem</h3>
                  <p className="text-sm text-muted-foreground">
                    DNS ayarlarınız korunarak kesintisiz transfer
                  </p>
                </div>
                <div className="text-center p-6 rounded-xl bg-card border">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/10">
                    <HeartHandshake className="h-7 w-7 text-purple-500" />
                  </div>
                  <h3 className="font-semibold mb-2">7/24 Destek</h3>
                  <p className="text-sm text-muted-foreground">
                    Transfer sürecinde yanınızdayız
                  </p>
                </div>
              </div>
            </BlurFade>

            <BlurFade delay={0.3} inView>
              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  "Ücretsiz WHOIS gizliliği",
                  "Kolay DNS yönetimi",
                  "Otomatik yenileme",
                  "E-posta yönlendirme",
                  "Domain kilitleme",
                  "Tüm uzantılar desteklenir",
                  "Toplu transfer imkanı",
                  "Rekabetçi fiyatlar",
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
                  Domain transferi hakkında merak edilenler
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <div className="max-w-3xl mx-auto">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>Domain transferi nedir?</AccordionTrigger>
                    <AccordionContent>
                      Domain transferi, alan adınızı bir kayıt firmasından başka bir kayıt
                      firmasına taşıma işlemidir. Bu işlem sırasında domain adınız ve tüm
                      ayarlarınız korunur, sadece yönetim KLEACORE&apos;a geçer.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger>Transfer ne kadar sürer?</AccordionTrigger>
                    <AccordionContent>
                      Genel TLD&apos;ler (.com, .net, .org vb.) için transfer süresi 5-7 gündür.
                      .tr uzantıları için bu süre 1-2 gün olabilir. E-posta onayını hızlı
                      yaparsanız süre kısalır.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-3">
                    <AccordionTrigger>EPP/Auth kodu nedir ve nasıl alınır?</AccordionTrigger>
                    <AccordionContent>
                      EPP (Extensible Provisioning Protocol) kodu, domain transferi için
                      gereken güvenlik şifresidir. Bu kodu mevcut kayıt firmanızın kontrol
                      panelinden veya destek ekibinden talep edebilirsiniz. Kod olmadan
                      transfer başlatılamaz.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-4">
                    <AccordionTrigger>Transfer ücreti ne kadar?</AccordionTrigger>
                    <AccordionContent>
                      Transfer ücreti domain uzantısına göre değişir ve genellikle yıllık
                      kayıt ücreti ile aynıdır. Ayrıca her transferde +1 yıl uzatma hediye
                      edilir, yani aslında 2 yıllık ücretle domain sürenizi uzatmış olursunuz.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-5">
                    <AccordionTrigger>Transfer sırasında sitem çalışır mı?</AccordionTrigger>
                    <AccordionContent>
                      Evet, DNS ayarlarınız korunduğu sürece web siteniz ve e-posta
                      hizmetleriniz kesintisiz çalışmaya devam eder. Transfer sadece
                      yönetim değişikliğidir, hosting ve DNS etkilenmez.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-6">
                    <AccordionTrigger>Yeni kayıtlı domain transfer edilebilir mi?</AccordionTrigger>
                    <AccordionContent>
                      Hayır, ICANN kurallarına göre yeni kaydedilen domainler 60 gün
                      içinde transfer edilemez. Aynı şekilde yeni transfer edilmiş
                      domainler de 60 gün beklemelidir.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-7">
                    <AccordionTrigger>Transfer reddedilirse ne olur?</AccordionTrigger>
                    <AccordionContent>
                      Transfer reddedilirse ödemeniz iade edilir. Reddetme nedenleri
                      genellikle hatalı EPP kodu, kilitli domain veya 60 günlük bekleme
                      süresinin dolmamış olmasıdır. Sorunu düzelttikten sonra tekrar
                      deneyebilirsiniz.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-8">
                    <AccordionTrigger>Toplu transfer yapabilir miyim?</AccordionTrigger>
                    <AccordionContent>
                      Evet, birden fazla domaini aynı anda transfer edebilirsiniz.
                      Toplu transfer için destek ekibimizle iletişime geçin, size
                      özel fiyatlar ve hızlandırılmış süreç sunabiliriz.
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