"use client";

import { useActionState, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BlurFade } from "@/components/magicui/blur-fade";
import { PageHero } from "@/components/sections/page-hero";
import {
  MapPin,
  Mail,
  Clock,
  MessageSquare,
  Headphones,
  Building2,
  Send,
  Zap,
  Globe,
  Briefcase,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitContactForm } from "@/lib/actions/contact";
import { toast } from "@/lib/toast";

const contactInfo = [
  {
    icon: Mail,
    title: "E-posta",
    details: ["support@kleacore.com", "sales@kleacore.com"],
    description: "24 saat içinde yanıt garantisi",
  },
  {
    icon: MapPin,
    title: "Adres",
    details: ["30 N Gould St Ste R", "Sheridan, WY 82801, USA"],
    description: "KLEAWORK DIGITAL LLC",
  },
  {
    icon: Clock,
    title: "Çalışma Saatleri",
    details: ["Teknik destek: 7/24", "Satış: Hafta içi 09:00 - 18:00"],
    description: "Tüm zaman dilimlerinde hizmet",
  },
  {
    icon: Briefcase,
    title: "Şirket Bilgileri",
    details: ["KLEAWORK DIGITAL LLC", "EIN: 36-5157418"],
    description: "Wyoming, USA",
  },
];

const supportChannels = [
  {
    icon: Headphones,
    title: "Teknik Destek",
    description: "7/24 teknik destek hattı",
    action: "Destek Talebi",
    href: "/musteri/destek",
  },
  {
    icon: MessageSquare,
    title: "Online Destek",
    description: "Destek merkezinden yardım alın",
    action: "Destek Merkezi",
    href: "/musteri/destek",
  },
  {
    icon: Building2,
    title: "Kurumsal Satış",
    description: "Özel çözümler için",
    action: "Teklif Al",
    href: "/iletisim?konu=Kurumsal Satış Teklifi",
  },
];

const responseTimes = [
  { channel: "Teknik Destek", time: "< 2 saat", note: "7/24 aktif" },
  { channel: "Satış Talepleri", time: "< 4 saat", note: "Hafta içi 09:00–18:00" },
  { channel: "Genel İletişim", time: "< 24 saat", note: "Tüm kanallar" },
];

const departments = [
  { name: "Satış", email: "sales@kleacore.com", description: "Yeni projeler ve fiyatlandırma" },
  { name: "Teknik Destek", email: "support@kleacore.com", description: "Teknik sorunlar ve yardım" },
  { name: "Muhasebe", email: "billing@kleacore.com", description: "Fatura ve ödeme işlemleri" },
  { name: "Genel", email: "info@kleacore.com", description: "Diğer tüm konular" },
];

const features = [
  {
    icon: Zap,
    title: "Hızlı Yanıt",
    description: "Taleplerinize en geç 24 saat içinde dönüş yapıyoruz.",
  },
  {
    icon: Globe,
    title: "Global Erişim",
    description: "Dünyanın her yerinden bize ulaşabilirsiniz.",
  },
  {
    icon: Headphones,
    title: "7/24 Destek",
    description: "Teknik ekibimiz her an yanınızda.",
  },
];

export function IletisimContent() {
  const searchParams = useSearchParams();
  const defaultSubject = searchParams.get("konu") ?? "";
  const [isSuccess, setIsSuccess] = useState(false);
  const [state, formAction, isPending] = useActionState(
    async (_prev: { success: boolean; error?: string } | null, formData: FormData) => {
      const result = await submitContactForm(formData);
      if (result.success) {
        setIsSuccess(true);
      }
      return result;
    },
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Mesajınız başarıyla gönderildi.");
      return;
    }
    if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <>
      <PageHero
        badge="7/24 Destek"
        badgeIcon={MessageSquare}
        title="Bize Ulaşın"
        description="Sorularınız için bize ulaşın. Sizin dilinizden konuşan ekibimiz yardımcı olmaktan mutluluk duyacaktır."
        accent="emerald"
      />

      <section className="border-b bg-muted/30 py-12">
        <div className="container">
          <BlurFade delay={0.1} inView>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
              {contactInfo.map((info) => (
                <Card key={info.title} className="text-center hover:border-primary/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
                      <info.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{info.title}</h3>
                    {info.details.map((detail) => (
                      <p key={detail} className="text-sm font-medium">
                        {detail}
                      </p>
                    ))}
                    <p className="text-xs text-muted-foreground mt-2">
                      {info.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </BlurFade>
        </div>
      </section>

      <section className="py-12 border-b">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto mb-10">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <BlurFade delay={0.1} inView>
            <div className="max-w-3xl mx-auto">
              <h2 className="text-center text-xl font-semibold mb-6">
                Yanıt Süreleri
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {responseTimes.map((item) => (
                  <Card key={item.channel}>
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">{item.channel}</p>
                      <p className="text-2xl font-bold text-primary mt-1">{item.time}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.note}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </BlurFade>
        </div>
      </section>

      {/* Contact Form & Support */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-2 max-w-6xl mx-auto">
            {/* Form */}
            <BlurFade delay={0.1} inView>
              <Card>
                <CardHeader>
                  <CardTitle>Bize Yazın</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Formu doldurun, en kısa sürede size dönüş yapalım.
                  </p>
                </CardHeader>
                <CardContent>
                  {isSuccess ? (
                    <div className="p-6 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 mb-4">
                        <Send className="h-6 w-6 text-green-600" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2">Mesajınız Gönderildi</h3>
                      <p className="text-sm text-muted-foreground">
                        En kısa sürede size dönüş yapacağız. Teşekkürler!
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => setIsSuccess(false)}
                      >
                        Yeni Mesaj Gönder
                      </Button>
                    </div>
                  ) : (
                    <form action={formAction} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="name">Ad Soyad</Label>
                          <Input
                            id="name"
                            name="name"
                            placeholder="Adınız Soyadınız"
                            required
                            disabled={isPending}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">E-posta</Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="ornek@email.com"
                            required
                            disabled={isPending}
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="phone">Telefon (Opsiyonel)</Label>
                          <Input
                            id="phone"
                            name="phone"
                            placeholder="+90 555 123 45 67"
                            disabled={isPending}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subject">Konu</Label>
                          <Input
                            id="subject"
                            name="subject"
                            placeholder="Mesaj konusu"
                            defaultValue={defaultSubject}
                            key={defaultSubject}
                            required
                            disabled={isPending}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="message">Mesajınız</Label>
                        <textarea
                          id="message"
                          name="message"
                          className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Size nasıl yardımcı olabiliriz?"
                          required
                          disabled={isPending}
                        />
                      </div>
                      {state && !state.success && state.error && (
                        <p className="text-sm text-red-500">{state.error}</p>
                      )}
                      <Button type="submit" className="w-full" disabled={isPending}>
                        <Send className="mr-2 h-4 w-4" />
                        {isPending ? "Gönderiliyor..." : "Mesaj Gönder"}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </BlurFade>

            {/* Support Channels & Company Info */}
            <BlurFade delay={0.2} inView>
              <div className="space-y-6">
                {/* Quick Support */}
                <div className="grid gap-4 sm:grid-cols-3">
                  {supportChannels.map((channel) => (
                    <Card
                      key={channel.title}
                      className="text-center hover:border-primary/50 transition-colors cursor-pointer"
                    >
                      <CardContent className="p-4">
                        <channel.icon className="h-8 w-8 text-primary mx-auto mb-2" />
                        <h4 className="font-medium text-sm">{channel.title}</h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          {channel.description}
                        </p>
                        <Button variant="link" size="sm" className="h-auto p-0" asChild>
                          <a href={channel.href}>{channel.action}</a>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Company Info */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-lg mb-4">Şirket Bilgileri</h3>
                    <div className="space-y-4">
                      <div>
                        <p className="font-medium">KLEAWORK DIGITAL LLC</p>
                        <p className="text-sm text-muted-foreground">
                          30 N Gould St Ste R, Sheridan, WY 82801, USA
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">EIN</p>
                          <p className="text-sm font-medium">36-5157418</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Kuruluş</p>
                          <p className="text-sm font-medium">Wyoming, USA - 2026</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Why Us */}
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-2">Neden KLEACORE?</h3>
                    <p className="text-sm text-muted-foreground">
                      2026&apos;nın modern standartlarıyla kurulduğumuz için eski nesil
                      hantallıklardan uzağız. Karmaşık terimlerle değil, sizin dilinizden
                      konuşan bir destek anlayışıyla her zaman yanınızdayız.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </BlurFade>
          </div>
        </div>
      </section>

      {/* Departments */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container">
          <BlurFade delay={0.1} inView>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Departmanlar
              </h2>
              <p className="mt-4 text-muted-foreground">
                Doğrudan ilgili birime ulaşın
              </p>
            </div>
          </BlurFade>

          <BlurFade delay={0.2} inView>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
              {departments.map((dept) => (
                <Card key={dept.name} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-1">{dept.name}</h3>
                    <p className="text-xs text-muted-foreground mb-3">{dept.description}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-primary" />
                      <a
                        href={`mailto:${dept.email}`}
                        className="text-primary hover:underline"
                      >
                        {dept.email}
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </BlurFade>
        </div>
      </section>

      {/* FAQ CTA */}
      <section className="py-16 md:py-24">
        <div className="container">
          <BlurFade delay={0.1} inView>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                Hızlı Cevaplar mı Arıyorsunuz?
              </h2>
              <p className="text-muted-foreground mb-8">
                Sık sorulan sorular ve bilgi bankamızda aradığınız cevabı
                bulabilirsiniz. 7/24 erişilebilir destek kaynaklarımız yanınızda.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="px-8" asChild>
                  <a href="/musteri/destek">Destek Merkezi</a>
                </Button>
                <Button size="lg" variant="outline" className="px-8" asChild>
                  <a href="/musteri/panel">Müşteri Paneli</a>
                </Button>
              </div>
            </div>
          </BlurFade>
        </div>
      </section>
    </>
  );
}
