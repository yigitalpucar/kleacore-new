"use client";

import { useState, Suspense } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BlurFade } from "@/components/magicui/blur-fade";
import {
  User,
  Shield,
  Headphones,
  FileText,
  CreditCard,
  Server,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";

const quickLinks = [
  {
    icon: Server,
    title: "Hizmetlerim",
    description: "Aktif hosting ve sunucu hizmetleri",
    href: "/musteri/panel/hizmetlerim",
  },
  {
    icon: Globe,
    title: "Alan Adlarım",
    description: "Domain yönetimi ve DNS ayarları",
    href: "/musteri/panel/domainler",
  },
  {
    icon: CreditCard,
    title: "Faturalarım",
    description: "Ödeme geçmişi ve faturalar",
    href: "/musteri/panel/faturalar",
  },
  {
    icon: Headphones,
    title: "Destek Talepleri",
    description: "Açık ve kapalı talepler",
    href: "/musteri/panel/destek",
  },
];

const features = [
  {
    icon: Shield,
    title: "Güvenli Giriş",
    description: "2FA ve SSL şifreleme ile korunan hesap",
  },
  {
    icon: FileText,
    title: "Kolay Yönetim",
    description: "Tüm hizmetlerinizi tek panelden yönetin",
  },
  {
    icon: Headphones,
    title: "7/24 Destek",
    description: "Anlık destek talebi oluşturma",
  },
];

export default function GirisPage() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1">
        <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <div className="grid gap-12 lg:grid-cols-2 items-center max-w-6xl mx-auto">
              {/* Form */}
              <BlurFade delay={0.1} inView>
                <Card className="max-w-md mx-auto lg:mx-0">
                  <CardHeader className="text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
                      <User className="h-7 w-7 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">
                      {isLogin ? "Müşteri Girişi" : "Hesap Oluştur"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-2">
                      {isLogin
                        ? "Hesabınıza giriş yapın"
                        : "Yeni bir hesap oluşturun"}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Yükleniyor...</div>}>
                      {isLogin ? (
                        <LoginForm onSwitch={() => setIsLogin(false)} />
                      ) : (
                        <RegisterForm onSwitch={() => setIsLogin(true)} />
                      )}
                    </Suspense>
                  </CardContent>
                </Card>
              </BlurFade>

              {/* Info */}
              <BlurFade delay={0.2} inView>
                <div className="space-y-8">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                      Müşteri Paneli
                    </h1>
                    <p className="text-muted-foreground">
                      Tüm hosting hizmetlerinizi, alan adlarınızı ve faturalarınızı
                      tek bir panelden yönetin. 7/24 destek talebi oluşturun.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {quickLinks.map((link) => (
                      <Card
                        key={link.title}
                        className="hover:border-primary/50 transition-colors cursor-pointer"
                      >
                        <CardContent className="p-4 flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                            <link.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-medium text-sm">{link.title}</h3>
                            <p className="text-xs text-muted-foreground">
                              {link.description}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {features.map((feature) => (
                      <div key={feature.title} className="text-center">
                        <feature.icon className="h-8 w-8 text-primary mx-auto mb-2" />
                        <h4 className="font-medium text-sm">{feature.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </BlurFade>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
