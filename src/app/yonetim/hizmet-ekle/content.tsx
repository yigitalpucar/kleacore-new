"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building,
  Check,
  Cloud,
  FileText,
  Globe,
  HardDrive,
  Loader2,
  Mail,
  Save,
  Search,
  Send,
  Server,
  Shield,
  StickyNote,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DetailList,
  EmptyState,
  FormField,
  PageHeader,
  SectionCard,
  UnavailableAction,
  appButton,
} from "@/components/app";
import { formatTRY } from "@/lib/format/price";
import { productPeriodPricing } from "@/lib/billing/period-price";
import { cn } from "@/lib/utils";
import { createService } from "@/lib/actions/admin/services";
import { toast } from "@/lib/toast";
import type { BillingPeriod, ProductCategorySlug } from "@prisma/client";

interface CustomerOption {
  id: string;
  name: string;
  email: string;
}

interface ProductOption {
  id: string;
  name: string;
  shortDescription: string;
  basePrice: number;
  category: {
    slug: ProductCategorySlug;
    name: string;
  };
  features: string[];
  pricingTiers: {
    period: BillingPeriod;
    price: number;
    isDefault: boolean;
  }[];
}

interface ServerOption {
  id: string;
  name: string;
  ip: string;
  location: string;
}

interface AddServiceContentProps {
  customers: CustomerOption[];
  products: ProductOption[];
  servers: ServerOption[];
}

const categoryConfig: Record<
  ProductCategorySlug,
  {
    id: ProductCategorySlug;
    name: string;
    icon: typeof Server;
  }
> = {
  hosting: { id: "hosting", name: "Web hosting", icon: Server },
  vds: { id: "vds", name: "VDS sunucu", icon: HardDrive },
  vps: { id: "vps", name: "VPS sunucu", icon: Cloud },
  server: { id: "server", name: "Fiziksel sunucu", icon: Server },
  domain: { id: "domain", name: "Alan adı", icon: Globe },
  ssl: { id: "ssl", name: "SSL sertifikası", icon: Shield },
  cloud: { id: "cloud", name: "Bulut sunucu", icon: Cloud },
  datacenter: { id: "datacenter", name: "Veri merkezi", icon: Building },
  email: { id: "email", name: "Kurumsal e-posta", icon: Mail },
};

const categories = Object.values(categoryConfig);

// Faturalama dönemleri
const billingPeriods: { id: BillingPeriod; name: string; months: number }[] = [
  { id: "monthly", name: "Aylık", months: 1 },
  { id: "quarterly", name: "3 aylık", months: 3 },
  { id: "semiannual", name: "6 aylık", months: 6 },
  { id: "yearly", name: "Yıllık", months: 12 },
  { id: "biennial", name: "2 yıllık", months: 24 },
  { id: "triennial", name: "3 yıllık", months: 36 },
];

function addMonthsToDate(date: string, months: number) {
  const target = new Date(date);
  target.setMonth(target.getMonth() + months);
  return target;
}

function getPeriodPricing(product: ProductOption, period: BillingPeriod) {
  return productPeriodPricing(
    {
      basePrice: product.basePrice,
      categorySlug: product.category.slug,
      pricingTiers: product.pricingTiers,
    },
    period
  );
}

function discountPercentOf(pricing: { base: number; discount: number }) {
  return pricing.base > 0 && pricing.discount > 0
    ? Math.round((pricing.discount / pricing.base) * 100)
    : 0;
}

export function AddServiceContent({
  customers,
  products,
  servers,
}: AddServiceContentProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const [formData, setFormData] = useState({
    customerId: "",
    category: "" as ProductCategorySlug | "",
    packageId: "",
    domain: "",
    billingPeriod: "yearly" as BillingPeriod,
    serverId: "",
    startDate: new Date().toISOString().split("T")[0],
    notes: "",
    createInvoice: true,
    sendNotification: true,
  });

  const handleInputChange = <K extends keyof typeof formData>(
    field: K,
    value: (typeof formData)[K]
  ) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "category") {
        next.packageId = "";
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;
    if (!formData.customerId || !formData.packageId) {
      toast.error("Müşteri ve paket seçimi zorunludur.");
      return;
    }

    if (needsDomain && !formData.domain.trim()) {
      toast.error("Bu kategori için domain zorunludur.");
      return;
    }

    if (!selectedPackage || !selectedPeriod) {
      toast.error("Geçerli bir paket ve faturalama dönemi seçin.");
      return;
    }

    setIsSubmitting(true);

    const result = await createService({
      customerId: formData.customerId,
      productId: formData.packageId,
      label: selectedPackage.name,
      domain: formData.domain.trim() || undefined,
      billingPeriod: formData.billingPeriod,
      serverName: selectedServer
        ? `${selectedServer.name} (${selectedServer.ip})`
        : undefined,
      nextDueDate: addMonthsToDate(formData.startDate, selectedPeriod.months).toISOString(),
      expiresAt: addMonthsToDate(formData.startDate, selectedPeriod.months).toISOString(),
    });

    if (result.success) {
      toast.success("Hizmet başarıyla oluşturuldu.");
      router.push("/yonetim/hizmetler");
    } else {
      setIsSubmitting(false);
      toast.error(result.error || "Hizmet oluşturulurken bir hata oluştu");
    }
  };

  // Seçili kategori için paketleri getir
  const selectedPackages = formData.category
    ? products.filter((product) => product.category.slug === formData.category)
    : [];

  // Seçili paket bilgisi
  const selectedPackage = selectedPackages.find((p) => p.id === formData.packageId);

  // Seçili faturalama dönemi
  const selectedPeriod = billingPeriods.find((p) => p.id === formData.billingPeriod);

  const selectedServer = servers.find((server) => server.id === formData.serverId);

  // Fiyat hesaplama
  // Same rule the server action uses to store Service.amount (period total).
  const pricing =
    selectedPackage && selectedPeriod
      ? getPeriodPricing(selectedPackage, selectedPeriod.id)
      : { base: 0, discount: 0, total: 0 };

  // Müşteri filtreleme
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // Kategori için domain gerekli mi?
  const needsDomain = ["hosting", "ssl", "email", "domain"].includes(
    formData.category
  );

  const money = (n: number) => formatTRY(n, { keepDecimals: true });
  const step = (n: number, label: string) => (
    <span className="flex items-center gap-2">
      <span className="font-mono text-[11px] text-muted-foreground">{String(n).padStart(2, "0")}</span>
      {label}
    </span>
  );
  const optionClass = (selected: boolean) =>
    cn(
      "relative rounded-md border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      selected ? "border-foreground bg-muted/60" : "hover:border-foreground/30 hover:bg-muted/30"
    );

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/hizmetler", label: "Hizmetler" }}
        title="Hizmet ekle"
        description="Bir müşteriye sipariş akışı dışında, elle yeni bir hizmet tanımlayın."
      />

      <form onSubmit={handleSubmit} className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Müşteri */}
          <SectionCard title={step(1, "Müşteri")} description="Hizmetin tanımlanacağı müşteriyi seçin.">
            <div className="space-y-3">
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  aria-label="Müşteri ara"
                  placeholder="Ad veya e-posta ile ara…"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="h-11 pl-9 md:h-9"
                />
              </div>
              {filteredCustomers.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  Aramanızla eşleşen müşteri bulunamadı.
                </p>
              ) : (
                <div
                  role="radiogroup"
                  aria-label="Müşteri"
                  className="grid max-h-[280px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 [scrollbar-width:thin]"
                >
                  {filteredCustomers.map((customer) => {
                    const selected = formData.customerId === customer.id;
                    return (
                      <button
                        key={customer.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => handleInputChange("customerId", customer.id)}
                        className={cn(optionClass(selected), "flex min-h-[52px] items-center gap-3 px-3 py-2")}
                      >
                        <span
                          aria-hidden
                          className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background font-mono text-[11px] uppercase"
                        >
                          {customer.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{customer.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{customer.email}</span>
                        </span>
                        {selected ? <Check aria-hidden className="size-4 shrink-0" /> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </SectionCard>

          {/* Kategori */}
          <SectionCard title={step(2, "Kategori")} description="Eklenecek hizmetin kategorisini seçin.">
            <div role="radiogroup" aria-label="Hizmet kategorisi" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {categories.map((category) => {
                const Icon = category.icon;
                const selected = formData.category === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleInputChange("category", category.id as ProductCategorySlug)}
                    className={cn(optionClass(selected), "flex min-h-[48px] items-center gap-2.5 px-3 py-2.5")}
                  >
                    <Icon aria-hidden className={cn("size-4 shrink-0", selected ? "text-foreground" : "text-muted-foreground")} />
                    <span className="text-[13px] font-medium leading-tight">{category.name}</span>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* Paket */}
          {formData.category ? (
            <SectionCard title={step(3, "Paket")} description="Müşteriye tanımlanacak paketi seçin.">
              {selectedPackages.length === 0 ? (
                <EmptyState compact title="Bu kategoride aktif paket bulunmuyor" description="Ürünler bölümünden pakete durum ve fiyat tanımlayabilirsiniz." />
              ) : (
                <div role="radiogroup" aria-label="Paket" className="grid gap-3 sm:grid-cols-2">
                  {selectedPackages.map((pkg) => {
                    const selected = formData.packageId === pkg.id;
                    const currentPeriod = selectedPeriod?.id ?? "monthly";
                    const packagePricing = getPeriodPricing(pkg, currentPeriod);
                    const packagePrice = packagePricing.total;
                    const featureList = pkg.features.length > 0 ? pkg.features : [pkg.shortDescription];
                    const discountPercent = discountPercentOf(packagePricing);
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => handleInputChange("packageId", pkg.id)}
                        className={cn(optionClass(selected), "p-4")}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold">{pkg.name}</span>
                          {selected ? <Check aria-hidden className="size-4 shrink-0" /> : null}
                        </span>
                        <span className="mt-1.5 block tabular-nums">
                          <span className="text-lg font-semibold">{money(packagePrice)}</span>
                          <span className="text-xs text-muted-foreground"> / {selectedPeriod?.name.toLocaleLowerCase("tr-TR") || "aylık"}</span>
                        </span>
                        {discountPercent > 0 ? (
                          <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">%{discountPercent} indirimli</span>
                        ) : null}
                        <span className="mt-3 block space-y-1 border-t border-dashed pt-3">
                          {featureList.filter(Boolean).map((feature, idx) => (
                            <span key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                              <span className="line-clamp-1">{feature}</span>
                            </span>
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          ) : null}

          {/* Detaylar */}
          {formData.packageId ? (
            <SectionCard title={step(4, "Hizmet detayları")}>
              <div className="space-y-5">
                {needsDomain ? (
                  <FormField label="Alan adı" htmlFor="domain" required hint="Örneğin ornek.com — bu kategori için zorunludur.">
                    <Input
                      id="domain"
                      placeholder="ornek.com"
                      value={formData.domain}
                      onChange={(e) => handleInputChange("domain", e.target.value)}
                      required={needsDomain}
                      className="h-11 md:h-9"
                    />
                  </FormField>
                ) : null}
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField label="Sunucu" htmlFor="serverId" hint={servers.length ? undefined : "Kayıtlı sunucu yok."}>
                    <Select value={formData.serverId} onValueChange={(value) => handleInputChange("serverId", value)}>
                      <SelectTrigger id="serverId" className="h-11 md:h-9">
                        <SelectValue placeholder="Sunucu seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {servers.map((server) => (
                          <SelectItem key={server.id} value={server.id}>
                            {server.name} ({server.location})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Başlangıç tarihi" htmlFor="startDate" hint="Yenileme tarihi bu tarihten bir dönem sonrasıdır.">
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange("startDate", e.target.value)}
                      className="h-11 md:h-9"
                    />
                  </FormField>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </div>

        <div className="space-y-6 lg:sticky lg:top-20">
          <SectionCard title="Faturalama dönemi">
            <div role="radiogroup" aria-label="Faturalama dönemi" className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {billingPeriods.map((period) => {
                const discountPercent = selectedPackage
                  ? discountPercentOf(getPeriodPricing(selectedPackage, period.id))
                  : 0;
                const selected = formData.billingPeriod === period.id;
                return (
                  <button
                    key={period.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleInputChange("billingPeriod", period.id)}
                    className={cn(optionClass(selected), "flex min-h-[44px] items-center justify-between gap-2 px-3 py-2 lg:min-h-[40px]")}
                  >
                    <span className="text-sm font-medium">{period.name}</span>
                    {discountPercent > 0 ? (
                      <span className="rounded border bg-background px-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                        %{discountPercent}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            title="Özet"
            footer={
              <div className="flex w-full flex-col gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.customerId || !formData.packageId}
                  className={appButton({ className: "w-full" })}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 aria-hidden className="animate-spin" />
                      Kaydediliyor…
                    </>
                  ) : (
                    <>
                      <Save aria-hidden />
                      Hizmeti kaydet
                    </>
                  )}
                </button>
                <Link href="/yonetim/hizmetler" className={appButton({ variant: "outline", className: "w-full" })}>
                  Vazgeç
                </Link>
              </div>
            }
          >
            {selectedPackage ? (
              <div className="space-y-3">
                <DetailList
                  items={[
                    { label: "Müşteri", value: customers.find((c) => c.id === formData.customerId)?.name ?? "Seçilmedi" },
                    { label: "Paket", value: selectedPackage.name },
                    { label: "Dönem", value: selectedPeriod?.name },
                    { label: "Liste fiyatı", value: <span className="tabular-nums">{money(pricing.base)}</span> },
                    ...(pricing.discount > 0
                      ? [{ label: "Dönem indirimi", value: <span className="tabular-nums">−{money(pricing.discount)}</span> }]
                      : []),
                  ]}
                />
                <div className="flex items-baseline justify-between border-t pt-3">
                  <span className="text-sm font-medium">Dönem tutarı</span>
                  <span className="text-lg font-semibold tabular-nums">{money(pricing.total)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {formData.customerId ? "Paket seçildiğinde fiyat burada görünür." : "Önce müşteri, kategori ve paket seçin."}
              </p>
            )}
          </SectionCard>

          <SectionCard title="Ek seçenekler" description="Bu seçenekler henüz hizmet kaydına bağlı değil.">
            <div className="space-y-2">
              <UnavailableAction layout="tile" label="Otomatik fatura oluştur" icon={<FileText aria-hidden />} reason="Yakında" />
              <UnavailableAction layout="tile" label="Müşteriye e-posta gönder" icon={<Send aria-hidden />} reason="Yakında" />
              <UnavailableAction layout="tile" label="Hizmet notu" icon={<StickyNote aria-hidden />} reason="Yakında" />
            </div>
          </SectionCard>
        </div>
      </form>
    </>
  );
}
