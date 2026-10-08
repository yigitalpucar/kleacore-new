"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Save, User } from "lucide-react";
import { FormField, FormSection, PageHeader, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createCustomer } from "@/lib/actions/admin/customers";
import { cn } from "@/lib/utils";

const TURKISH_CITIES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin",
  "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa",
  "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum",
  "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkâri", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir",
  "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kilis", "Kırıkkale", "Kırklareli",
  "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir",
  "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop", "Şırnak", "Sivas",
  "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak",
];

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type CustomerType = "INDIVIDUAL" | "CORPORATE";

const TYPES: { value: CustomerType; label: string; hint: string; icon: typeof User }[] = [
  { value: "INDIVIDUAL", label: "Bireysel", hint: "Şahıs adına açılan hesap", icon: User },
  { value: "CORPORATE", label: "Kurumsal", hint: "Şirket adına, vergi bilgili hesap", icon: Building2 },
];

export function AddCustomerForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerType, setCustomerType] = useState<CustomerType>("INDIVIDUAL");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("customerType", customerType);

    const result = await createCustomer(formData);

    if (result.success) {
      router.push("/yonetim/musteriler");
    } else {
      setError(result.error || "Bir hata oluştu");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/musteriler", label: "Müşteriler" }}
        title="Müşteri ekle"
        description="Sisteme yeni bir müşteri hesabı açın. Müşteri, belirlediğiniz şifreyle panele giriş yapabilir."
      />

      {error ? (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-8">
        <FormSection title="Müşteri tipi" description="Kurumsal hesaplarda firma ve vergi bilgileri faturaya yazılır.">
          <fieldset>
            <legend className="sr-only">Müşteri tipi</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {TYPES.map((t) => {
                const checked = customerType === t.value;
                return (
                  <label
                    key={t.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      checked ? "border-foreground bg-muted/50" : "hover:bg-muted/40"
                    )}
                  >
                    <input
                      type="radio"
                      name="customerTypeChoice"
                      value={t.value}
                      checked={checked}
                      onChange={() => setCustomerType(t.value)}
                      className="sr-only"
                    />
                    <t.icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", checked ? "text-foreground" : "text-muted-foreground")} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{t.label}</span>
                      <span className="block text-xs text-muted-foreground">{t.hint}</span>
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "ml-auto mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                        checked && "border-foreground"
                      )}
                    >
                      {checked ? <span className="size-2 rounded-full bg-foreground" /> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </FormSection>

        <FormSection title="Kişisel bilgiler" description="Giriş ve iletişim için kullanılır.">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Ad" htmlFor="name" required>
              <Input id="name" name="name" autoComplete="off" required />
            </FormField>
            <FormField label="Soyad" htmlFor="surname" required>
              <Input id="surname" name="surname" autoComplete="off" required />
            </FormField>
            <FormField label="E-posta" htmlFor="email" required>
              <Input id="email" name="email" type="email" placeholder="ornek@firma.com" autoComplete="off" required />
            </FormField>
            <FormField label="Telefon" htmlFor="phone">
              <Input id="phone" name="phone" type="tel" placeholder="0532 123 45 67" autoComplete="off" />
            </FormField>
          </div>
          <FormField label="Şifre" htmlFor="password" required hint="En az 6 karakter. Müşteriye güvenli bir kanaldan iletin.">
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={6} />
          </FormField>
        </FormSection>

        {customerType === "CORPORATE" ? (
          <FormSection title="Şirket bilgileri" description="Faturada görünecek unvan ve vergi bilgileri.">
            <FormField label="Şirket adı" htmlFor="companyName" required>
              <Input id="companyName" name="companyName" required />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Vergi numarası" htmlFor="taxNumber">
                <Input id="taxNumber" name="taxNumber" inputMode="numeric" placeholder="1234567890" />
              </FormField>
              <FormField label="Vergi dairesi" htmlFor="taxOffice">
                <Input id="taxOffice" name="taxOffice" />
              </FormField>
            </div>
          </FormSection>
        ) : null}

        <FormSection
          title="Adres"
          description="Fatura adresi. İsteğe bağlı."
          footer={
            <>
              <Link href="/yonetim/musteriler" className={appButton({ variant: "outline" })}>
                Vazgeç
              </Link>
              <button type="submit" disabled={isSubmitting} className={appButton()}>
                {isSubmitting ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
                {isSubmitting ? "Kaydediliyor…" : "Müşteriyi kaydet"}
              </button>
            </>
          }
        >
          <FormField label="Adres" htmlFor="address">
            <Textarea id="address" name="address" placeholder="Mahalle, sokak, bina ve daire no" className="min-h-20" />
          </FormField>
          <FormField label="İl" htmlFor="city">
            <select id="city" name="city" defaultValue="" className={selectClass}>
              <option value="">İl seçin</option>
              {TURKISH_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </FormField>
        </FormSection>
      </form>
    </>
  );
}
