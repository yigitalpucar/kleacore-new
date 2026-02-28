"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Save,
  Loader2,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { BlurFade } from "@/components/magicui/blur-fade";
import { createCustomer } from "@/lib/actions/admin/customers";

export default function AddCustomerPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerType, setCustomerType] = useState<"INDIVIDUAL" | "CORPORATE">("INDIVIDUAL");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("customerType", customerType);

    const result = await createCustomer(formData);

    if (result.success) {
      router.push("/yonetim/musteriler");
    } else {
      setError(result.error || "Bir hata oluştu");
      setIsSubmitting(false);
    }
  };

  const turkishCities = [
    "Adana", "Adiyaman", "Afyonkarahisar", "Agri", "Amasya", "Ankara", "Antalya", "Artvin",
    "Aydin", "Balikesir", "Bilecik", "Bingol", "Bitlis", "Bolu", "Burdur", "Bursa",
    "Canakkale", "Cankiri", "Corum", "Denizli", "Diyarbakir", "Edirne", "Elazig", "Erzincan",
    "Erzurum", "Eskisehir", "Gaziantep", "Giresun", "Gumushane", "Hakkari", "Hatay", "Isparta",
    "Mersin", "Istanbul", "Izmir", "Kars", "Kastamonu", "Kayseri", "Kirklareli", "Kirsehir",
    "Kocaeli", "Konya", "Kutahya", "Malatya", "Manisa", "Kahramanmaras", "Mardin", "Mugla",
    "Mus", "Nevsehir", "Nigde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop",
    "Sivas", "Tekirdag", "Tokat", "Trabzon", "Tunceli", "Sanliurfa", "Usak", "Van",
    "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman", "Kirikkale", "Batman", "Sirnak",
    "Bartin", "Ardahan", "Igdir", "Yalova", "Karabuk", "Kilis", "Osmaniye", "Duzce"
  ].sort();

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <Link
          href="/yonetim/musteriler"
          className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Müşterilere Dön
        </Link>
      </BlurFade>

      <BlurFade delay={0.1}>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Yeni Müşteri Ekle</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Sisteme yeni bir müşteri kaydı oluşturun</p>
        </div>
      </BlurFade>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <BlurFade delay={0.2}>
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Müşteri Tipi
                  </CardTitle>
                  <CardDescription className="text-zinc-500">
                    Müşteri bireysel mi yoksa kurumsal mı?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setCustomerType("INDIVIDUAL")}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        customerType === "INDIVIDUAL"
                          ? "border-primary bg-primary/5"
                          : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                      }`}
                    >
                      <User className={`h-6 w-6 mb-2 ${customerType === "INDIVIDUAL" ? "text-primary" : "text-zinc-500"}`} />
                      <p className={`font-medium ${customerType === "INDIVIDUAL" ? "text-primary" : "text-zinc-900 dark:text-white"}`}>
                        Bireysel
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">Kişisel müşteri hesabı</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerType("CORPORATE")}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        customerType === "CORPORATE"
                          ? "border-primary bg-primary/5"
                          : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                      }`}
                    >
                      <Building2 className={`h-6 w-6 mb-2 ${customerType === "CORPORATE" ? "text-primary" : "text-zinc-500"}`} />
                      <p className={`font-medium ${customerType === "CORPORATE" ? "text-primary" : "text-zinc-900 dark:text-white"}`}>
                        Kurumsal
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">Şirket hesabı</p>
                    </button>
                  </div>
                </CardContent>
              </Card>
            </BlurFade>

            <BlurFade delay={0.3}>
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Kişisel Bilgiler
                  </CardTitle>
                  <CardDescription className="text-zinc-500">
                    Müşterinin temel iletişim bilgileri
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-zinc-700 dark:text-zinc-300">
                        Ad <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="Müşteri adı"
                        required
                        className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="surname" className="text-zinc-700 dark:text-zinc-300">
                        Soyad <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="surname"
                        name="surname"
                        placeholder="Müşteri soyadı"
                        required
                        className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-zinc-700 dark:text-zinc-300">
                        <Mail className="inline h-4 w-4 mr-1" />
                        E-posta <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="ornek@email.com"
                        required
                        className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-zinc-700 dark:text-zinc-300">
                        <Phone className="inline h-4 w-4 mr-1" />
                        Telefon
                      </Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="0532 123 45 67"
                        className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-zinc-700 dark:text-zinc-300">
                      <Lock className="inline h-4 w-4 mr-1" />
                      Şifre <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Müşteri şifresi"
                      required
                      minLength={6}
                      className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                    />
                  </div>
                </CardContent>
              </Card>
            </BlurFade>

            {customerType === "CORPORATE" && (
              <BlurFade delay={0.35}>
                <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-zinc-900 dark:text-white flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Şirket Bilgileri
                    </CardTitle>
                    <CardDescription className="text-zinc-500">
                      Kurumsal müşteri için şirket detayları
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName" className="text-zinc-700 dark:text-zinc-300">
                        Şirket Adı <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="companyName"
                        name="companyName"
                        placeholder="Şirket adı"
                        required={customerType === "CORPORATE"}
                        className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="taxNumber" className="text-zinc-700 dark:text-zinc-300">
                          Vergi Numarası
                        </Label>
                        <Input
                          id="taxNumber"
                          name="taxNumber"
                          placeholder="1234567890"
                          className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="taxOffice" className="text-zinc-700 dark:text-zinc-300">
                          Vergi Dairesi
                        </Label>
                        <Input
                          id="taxOffice"
                          name="taxOffice"
                          placeholder="Vergi dairesi adı"
                          className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </BlurFade>
            )}

            <BlurFade delay={0.4}>
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Adres Bilgileri
                  </CardTitle>
                  <CardDescription className="text-zinc-500">
                    Fatura ve teslimat adresi
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-zinc-700 dark:text-zinc-300">
                      Adres
                    </Label>
                    <Textarea
                      id="address"
                      name="address"
                      placeholder="Sokak, mahalle, bina no, daire no..."
                      className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500 min-h-20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-zinc-700 dark:text-zinc-300">
                      İl
                    </Label>
                    <Select name="city">
                      <SelectTrigger className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white">
                        <SelectValue placeholder="İl seçin" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                        {turkishCities.map((city) => (
                          <SelectItem key={city} value={city}>
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </BlurFade>
          </div>

          <div className="space-y-6">
            <BlurFade delay={0.55}>
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardContent className="p-4 space-y-3">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Kaydediliyor...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Müşteriyi Kaydet
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/yonetim/musteriler")}
                    className="w-full border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  >
                    İptal
                  </Button>
                </CardContent>
              </Card>
            </BlurFade>
          </div>
        </div>
      </form>
    </div>
  );
}
