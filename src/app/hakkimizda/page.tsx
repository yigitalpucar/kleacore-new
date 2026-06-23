import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BlurFade } from "@/components/magicui/blur-fade";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { PageHero } from "@/components/sections/page-hero";
import {
  Building2,
  Target,
  Eye,
  Lightbulb,
  Clock,
  Shield,
  Zap,
  HeartHandshake,
  Globe,
  Server,
  Headphones,
  Rocket,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const stats = [
  {
    value: 99.9,
    suffix: "%",
    label: "Uptime Garantisi",
    icon: Server,
    decimal: 1,
  },
  {
    value: 24,
    suffix: "/7",
    label: "Teknik Destek",
    icon: Headphones,
  },
  {
    value: 100,
    suffix: "+",
    label: "Mutlu Müşteri",
    icon: HeartHandshake,
  },
  {
    value: 2026,
    suffix: "",
    label: "Kuruluş Yılı",
    icon: Clock,
  },
];

const milestones = [
  {
    year: "2026 Q1",
    title: "KLEACORE Kuruluşu",
    description:
      "KLEAWORK DIGITAL LLC bünyesinde, modern hosting standartlarıyla yola çıktık.",
  },
  {
    year: "2026 Q1",
    title: "Altyapı Lansmanı",
    description:
      "NVMe SSD, LiteSpeed ve yedekli ağ altyapısı ile hosting ve sunucu hizmetlerini yayına aldık.",
  },
  {
    year: "2026 Q2",
    title: "Müşteri Paneli",
    description:
      "Domain, hosting ve sunucu yönetimini tek panelden sunan müşteri altyapısını devreye aldık.",
  },
  {
    year: "2026",
    title: "Büyüme Hedefi",
    description:
      "Türkiye ve global pazarda güvenilir, hızlı ve şeffaf bir teknoloji ortağı olmayı hedefliyoruz.",
  },
];

const values = [
  {
    icon: Lightbulb,
    title: "Yenilikçi Yaklaşım",
    description:
      "2026'nın modern standartlarıyla kurulduğumuz için eski nesil hantallıklardan uzağız.",
  },
  {
    icon: Zap,
    title: "Hız Odaklılık",
    description:
      "Dijitalde zamanın ne kadar kıymetli olduğunu biliyoruz. Altyapımızı maksimum performans için optimize ediyoruz.",
  },
  {
    icon: HeartHandshake,
    title: "Kesintisiz Destek",
    description:
      "Karmaşık terimlerle değil, sizin dilinizden konuşan bir destek anlayışıyla her zaman yanınızdayız.",
  },
  {
    icon: Shield,
    title: "Güvenli Altyapı",
    description:
      "Verilerinizin güvenliğini, en modern güvenlik protokolleriyle en üst seviyede tutuyoruz.",
  },
];

export default function HakkimizdaPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1">
        <PageHero
          badge="2026'da Kurulan"
          title="İşinizi Dijitalde Büyüten"
          titleHighlight="Teknoloji Ortağınız"
          description="Dijital dünyanın hızına ve dinamizmine uyum sağlamak amacıyla temellerimizi attık. Yalnızca bir yer sağlayıcı değil, işinizi dijitalde büyüten teknoloji ortağınız olmayı hedefliyoruz."
          accent="default"
        />

        <section className="border-b bg-muted/30 py-12">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4 max-w-4xl mx-auto">
                {stats.map((stat) => (
                  <Card key={stat.label} className="text-center">
                    <CardContent className="p-6">
                      <stat.icon className="h-8 w-8 text-primary mx-auto mb-3" />
                      <div className="flex justify-center items-baseline gap-0.5">
                        <NumberTicker
                          value={stat.value}
                          className="text-3xl font-bold"
                          decimalPlaces={stat.decimal || 0}
                        />
                        <span className="text-xl font-bold text-primary">
                          {stat.suffix}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {stat.label}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </BlurFade>
          </div>
        </section>

        {/* Story */}
        <section className="py-16 md:py-24">
          <div className="container">
            <div className="grid gap-12 lg:grid-cols-2 items-center max-w-6xl mx-auto">
              <BlurFade delay={0.1} inView>
                <div>
                  <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
                    Hikayemiz
                  </h2>
                  <div className="space-y-4 text-muted-foreground">
                    <p>
                      2026 yılında, dijital dünyanın hızına ve dinamizmine uyum sağlamak
                      amacıyla temellerimizi attık. KLEACORE olarak, yalnızca bir yer
                      sağlayıcı değil, işinizi dijitalde büyüten teknoloji ortağınız
                      olmayı hedefliyoruz.
                    </p>
                    <p>
                      Teknolojinin her saniye değiştiği bir çağda, yerimizde saymıyoruz.
                      Sektördeki en yeni donanımları ve yazılım çözümlerini yakından takip
                      ederek, projelerinizi en güncel altyapıda barındırıyoruz.
                    </p>
                    <p>
                      Bizim için teknoloji, karmaşıklık değil; size sunulan bir kolaylık
                      ve hız demektir. Her adımda müşterilerimizin yanında olarak,
                      dijital başarılarına ortak olmayı amaçlıyoruz.
                    </p>
                  </div>
                </div>
              </BlurFade>

              <BlurFade delay={0.2} inView>
                <div className="relative">
                  <div className="aspect-video rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Rocket className="h-24 w-24 text-primary/50" />
                  </div>
                </div>
              </BlurFade>
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Yolculuğumuz
                </h2>
                <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                  2026&apos;da kurulan KLEACORE&apos;un kısa ama hızlı büyüme hikayesi
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <div className="relative max-w-3xl mx-auto">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-border md:left-1/2 md:-translate-x-px" />
                <div className="space-y-8">
                  {milestones.map((item, index) => (
                    <div
                      key={item.title}
                      className={`relative flex flex-col gap-4 md:flex-row md:items-center ${
                        index % 2 === 0 ? "md:flex-row-reverse" : ""
                      }`}
                    >
                      <div className="hidden md:block md:w-1/2" />
                      <div className="absolute left-4 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border bg-background md:left-1/2">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <Card className={`ml-12 md:ml-0 md:w-1/2 ${index % 2 === 0 ? "md:pr-12" : "md:pl-12 md:ml-auto"}`}>
                        <CardContent className="p-6">
                          <p className="text-sm font-medium text-primary mb-1">
                            {item.year}
                          </p>
                          <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            </BlurFade>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="py-16 md:py-24">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Vizyonumuz ve Değerlerimiz
                </h2>
                <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                  Teknolojinin her saniye değiştiği bir çağda, yerimizde saymıyoruz
                </p>
              </div>
            </BlurFade>

            <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto mb-12">
              <BlurFade delay={0.1} inView>
                <Card className="h-full hover:border-primary/50 transition-colors">
                  <CardContent className="p-8">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-6">
                      <Target className="h-7 w-7 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold mb-4">Misyonumuz</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      İşletmelerin dijital dönüşümüne güvenilir, yüksek performanslı
                      ve modern altyapı çözümleriyle katkıda bulunmak. Karmaşıklığı
                      basitleştirerek, teknolojinin size sunduğu kolaylık ve hızı
                      deneyimlemenizi sağlamak.
                    </p>
                  </CardContent>
                </Card>
              </BlurFade>

              <BlurFade delay={0.2} inView>
                <Card className="h-full hover:border-primary/50 transition-colors">
                  <CardContent className="p-8">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-6">
                      <Eye className="h-7 w-7 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold mb-4">Vizyonumuz</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      Sektördeki en yeni donanımları ve yazılım çözümlerini yakından
                      takip ederek, projelerinizi en güncel altyapıda barındırmak.
                      Yalnızca bir hizmet sağlayıcı değil, işinizi dijitalde büyüten
                      gerçek bir teknoloji ortağı olmak.
                    </p>
                  </CardContent>
                </Card>
              </BlurFade>
            </div>
          </div>
        </section>

        {/* Why KLEACORE */}
        <section className="py-16 md:py-24">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Neden KLEACORE?
                </h2>
                <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                  Bizi tercih etmeniz için dört önemli neden
                </p>
              </div>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
                {values.map((value) => (
                  <Card
                    key={value.title}
                    className="text-center hover:border-primary/50 transition-colors"
                  >
                    <CardContent className="p-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
                        <value.icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2">
                        {value.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {value.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </BlurFade>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container">
            <BlurFade delay={0.1} inView>
              <div className="max-w-3xl mx-auto text-center">
                <Globe className="h-12 w-12 text-primary mx-auto mb-6" />
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                  Dijital Yolculuğunuza Başlayın
                </h2>
                <p className="text-muted-foreground mb-8">
                  KLEACORE ile tanışın, projelerinizi en güncel teknoloji altyapısında barındırın.
                  Sorularınız için 7/24 destek ekibimiz yanınızda.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" className="px-8" asChild>
                    <Link href="/iletisim">Bize Ulaşın</Link>
                  </Button>
                  <Button size="lg" variant="outline" className="px-8" asChild>
                    <Link href="/hosting/linux">Paketleri İncele</Link>
                  </Button>
                </div>
              </div>
            </BlurFade>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
