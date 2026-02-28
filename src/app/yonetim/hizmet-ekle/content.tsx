"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Server,
  HardDrive,
  Cloud,
  Building,
  Globe,
  Shield,
  Mail,
  User,
  Package,
  Calendar,
  CreditCard,
  Save,
  Loader2,
  Search,
  Check,
  FileText,
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
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
    color: string;
  }
> = {
  hosting: { id: "hosting", name: "Web Hosting", icon: Server, color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  vds: { id: "vds", name: "VDS Sunucu", icon: HardDrive, color: "bg-purple-500/10 text-purple-500 border-purple-500/30" },
  vps: { id: "vps", name: "VPS Sunucu", icon: Cloud, color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30" },
  server: { id: "server", name: "Fiziksel Sunucu", icon: Server, color: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
  domain: { id: "domain", name: "Domain", icon: Globe, color: "bg-green-500/10 text-green-500 border-green-500/30" },
  ssl: { id: "ssl", name: "SSL Sertifikası", icon: Shield, color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" },
  cloud: { id: "cloud", name: "Bulut Sunucu", icon: Cloud, color: "bg-sky-500/10 text-sky-500 border-sky-500/30" },
  datacenter: { id: "datacenter", name: "Veri Merkezi", icon: Building, color: "bg-slate-500/10 text-slate-500 border-slate-500/30" },
  email: { id: "email", name: "Kurumsal E-posta", icon: Mail, color: "bg-pink-500/10 text-pink-500 border-pink-500/30" },
};

const categories = Object.values(categoryConfig);

// Faturalama dönemleri
const billingPeriods: { id: BillingPeriod; name: string; months: number }[] = [
  { id: "monthly", name: "Aylık", months: 1 },
  { id: "quarterly", name: "3 Aylık", months: 3 },
  { id: "semiannual", name: "6 Aylık", months: 6 },
  { id: "yearly", name: "Yıllık", months: 12 },
  { id: "biennial", name: "2 Yıllık", months: 24 },
  { id: "triennial", name: "3 Yıllık", months: 36 },
];

function addMonthsToDate(date: string, months: number) {
  const target = new Date(date);
  target.setMonth(target.getMonth() + months);
  return target;
}

function getPriceForPeriod(product: ProductOption, period: BillingPeriod) {
  const exact = product.pricingTiers.find((tier) => tier.period === period);
  if (exact) return exact.price;

  const defaultTier = product.pricingTiers.find((tier) => tier.isDefault);
  if (defaultTier) return defaultTier.price;

  return product.basePrice;
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
      amount: pricing.total,
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
  const calculatePrice = () => {
    if (!selectedPackage || !selectedPeriod) return { base: 0, discount: 0, total: 0 };

    const monthlyPrice = getPriceForPeriod(selectedPackage, "monthly");
    const periodPrice = getPriceForPeriod(selectedPackage, selectedPeriod.id);
    const base = monthlyPrice * selectedPeriod.months;
    const discount = Math.max(0, base - periodPrice);
    const total = periodPrice;

    return { base, discount, total };
  };

  const pricing = calculatePrice();

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

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <BlurFade delay={0}>
        <Link
          href="/yonetim/hizmetler"
          className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Hizmetlere Dön
        </Link>
      </BlurFade>

      {/* Page Header */}
      <BlurFade delay={0.1}>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Yeni Hizmet Ekle</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Müşteriye yeni bir hizmet tanımlayın</p>
        </div>
      </BlurFade>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Müşteri Seçimi */}
            <BlurFade delay={0.2}>
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Müşteri Seçimi
                  </CardTitle>
                  <CardDescription className="text-zinc-500">
                    Hizmetin tanımlanacağı müşteriyi seçin
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      placeholder="Müşteri ara..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="pl-10 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                    />
                  </div>
                  <div className="grid gap-2 max-h-48 overflow-y-auto">
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleInputChange("customerId", customer.id)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                          formData.customerId === customer.id
                            ? "border-primary bg-primary/5"
                            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm font-medium">
                            {customer.name.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <div>
                            <p className={cn(
                              "text-sm font-medium",
                              formData.customerId === customer.id ? "text-primary" : "text-zinc-900 dark:text-white"
                            )}>
                              {customer.name}
                            </p>
                            <p className="text-xs text-zinc-500">{customer.email}</p>
                          </div>
                        </div>
                        {formData.customerId === customer.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </BlurFade>

            {/* Kategori Seçimi */}
            <BlurFade delay={0.3}>
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Hizmet Kategorisi
                  </CardTitle>
                  <CardDescription className="text-zinc-500">
                    Eklenecek hizmetin kategorisini seçin
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {categories.map((category) => {
                      const Icon = category.icon;
                      const isSelected = formData.category === category.id;
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => handleInputChange("category", category.id as ProductCategorySlug)}
                          className={cn(
                            "flex flex-col items-center p-4 rounded-lg border-2 transition-all",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                          )}
                        >
                          <div className={cn("p-2 rounded-lg mb-2", category.color)}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className={cn(
                            "text-xs font-medium text-center",
                            isSelected ? "text-primary" : "text-zinc-700 dark:text-zinc-300"
                          )}>
                            {category.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </BlurFade>

            {/* Paket Seçimi */}
            {formData.category && (
              <BlurFade delay={0.35}>
                <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-zinc-900 dark:text-white flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      Paket Seçimi
                    </CardTitle>
                    <CardDescription className="text-zinc-500">
                      Müşteriye tanımlanacak paketi seçin
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-3">
                      {selectedPackages.map((pkg) => {
                        const isSelected = formData.packageId === pkg.id;
                        const currentPeriod = selectedPeriod?.id ?? "monthly";
                        const packagePrice = getPriceForPeriod(pkg, currentPeriod);
                        const monthlyPrice = getPriceForPeriod(pkg, "monthly");
                        const featureList =
                          pkg.features.length > 0
                            ? pkg.features
                            : [pkg.shortDescription];

                        return (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => handleInputChange("packageId", pkg.id)}
                            className={cn(
                              "p-4 rounded-lg border-2 transition-all text-left",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                            )}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={cn(
                                "font-medium",
                                isSelected ? "text-primary" : "text-zinc-900 dark:text-white"
                              )}>
                                {pkg.name}
                              </span>
                              {isSelected && <Check className="h-4 w-4 text-primary" />}
                            </div>
                            <p className="text-lg font-bold text-zinc-900 dark:text-white mb-2">
                              ₺{packagePrice.toLocaleString("tr-TR")}
                              <span className="text-xs font-normal text-zinc-500">
                                /{selectedPeriod?.name || "Aylık"}
                              </span>
                            </p>
                            {selectedPeriod && selectedPeriod.months > 1 && packagePrice < monthlyPrice * selectedPeriod.months && (
                              <p className="text-xs text-green-500 mb-2">
                                %{Math.round((1 - packagePrice / (monthlyPrice * selectedPeriod.months)) * 100)} indirimli
                              </p>
                            )}
                            <div className="space-y-1">
                              {featureList.map((feature, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <div className="h-1 w-1 rounded-full bg-zinc-400" />
                                  <span className="text-xs text-zinc-500">{feature}</span>
                                </div>
                              ))}
                            </div>
                          </button>
                        );
                      })}
                      {selectedPackages.length === 0 && (
                        <div className="col-span-full rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-sm text-zinc-500">
                          Bu kategoride aktif paket bulunmuyor.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </BlurFade>
            )}

            {/* Domain ve Ek Bilgiler */}
            {formData.packageId && (
              <BlurFade delay={0.4}>
                <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-zinc-900 dark:text-white flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      Hizmet Detayları
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {needsDomain && (
                      <div className="space-y-2">
                        <Label htmlFor="domain" className="text-zinc-700 dark:text-zinc-300">
                          Domain Adı <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="domain"
                          placeholder="ornek.com"
                          value={formData.domain}
                          onChange={(e) => handleInputChange("domain", e.target.value)}
                          required={needsDomain}
                          className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                        />
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-zinc-700 dark:text-zinc-300">Sunucu</Label>
                        <Select
                          value={formData.serverId}
                          onValueChange={(value) => handleInputChange("serverId", value)}
                        >
                          <SelectTrigger className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white">
                            <SelectValue placeholder="Sunucu seçin" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                            {servers.map((server) => (
                              <SelectItem key={server.id} value={server.id}>
                                {server.name} ({server.location})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="startDate" className="text-zinc-700 dark:text-zinc-300">
                          Başlangıç Tarihi
                        </Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => handleInputChange("startDate", e.target.value)}
                          className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </BlurFade>
            )}
          </div>

          {/* Right Column - Summary & Actions */}
          <div className="space-y-6">
            {/* Faturalama Dönemi */}
            <BlurFade delay={0.45}>
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Faturalama Dönemi
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {billingPeriods.map((period) => {
                    const basePrice = selectedPackage
                      ? getPriceForPeriod(selectedPackage, "monthly") * period.months
                      : 0;
                    const periodPrice = selectedPackage
                      ? getPriceForPeriod(selectedPackage, period.id)
                      : 0;
                    const discountPercent =
                      selectedPackage && basePrice > 0 && periodPrice < basePrice
                        ? Math.round((1 - periodPrice / basePrice) * 100)
                        : 0;

                    return (
                    <button
                      key={period.id}
                      type="button"
                      onClick={() => handleInputChange("billingPeriod", period.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
                        formData.billingPeriod === period.id
                          ? "border-primary bg-primary/5"
                          : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                      )}
                    >
                      <span className={cn(
                        "text-sm font-medium",
                        formData.billingPeriod === period.id ? "text-primary" : "text-zinc-900 dark:text-white"
                      )}>
                        {period.name}
                      </span>
                      {discountPercent > 0 && (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                          %{discountPercent} indirim
                        </Badge>
                      )}
                    </button>
                    );
                  })}
                </CardContent>
              </Card>
            </BlurFade>

            {/* Fiyat Özeti */}
            <BlurFade delay={0.5}>
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Fiyat Özeti
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedPackage ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Paket</span>
                        <span className="text-zinc-900 dark:text-white">{selectedPackage.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Dönem</span>
                        <span className="text-zinc-900 dark:text-white">{selectedPeriod?.name}</span>
                      </div>
                      <Separator className="bg-zinc-200 dark:bg-zinc-800" />
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Ara Toplam</span>
                        <span className="text-zinc-900 dark:text-white">₺{pricing.base.toLocaleString("tr-TR")}</span>
                      </div>
                      {pricing.discount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">İndirim</span>
                          <span className="text-green-500">-₺{pricing.discount.toLocaleString("tr-TR")}</span>
                        </div>
                      )}
                      <Separator className="bg-zinc-200 dark:bg-zinc-800" />
                      <div className="flex justify-between">
                        <span className="font-medium text-zinc-900 dark:text-white">Toplam</span>
                        <span className="text-xl font-bold text-primary">₺{pricing.total.toLocaleString("tr-TR")}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-zinc-500 text-center py-4">
                      Paket seçildiğinde fiyat görüntülenecek
                    </p>
                  )}
                </CardContent>
              </Card>
            </BlurFade>

            {/* Ek Seçenekler */}
            <BlurFade delay={0.55}>
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white text-base">Ek Seçenekler</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">Fatura Oluştur</p>
                      <p className="text-xs text-zinc-500">Otomatik fatura oluştur</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInputChange("createInvoice", !formData.createInvoice)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        formData.createInvoice ? "bg-primary" : "bg-zinc-300 dark:bg-zinc-700"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          formData.createInvoice ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                  <Separator className="bg-zinc-200 dark:bg-zinc-800" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">Bildirim Gönder</p>
                      <p className="text-xs text-zinc-500">Müşteriye e-posta gönder</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInputChange("sendNotification", !formData.sendNotification)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        formData.sendNotification ? "bg-primary" : "bg-zinc-300 dark:bg-zinc-700"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          formData.sendNotification ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </BlurFade>

            {/* Notlar */}
            <BlurFade delay={0.6}>
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notlar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Hizmet hakkında özel notlar..."
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500 min-h-20"
                  />
                </CardContent>
              </Card>
            </BlurFade>

            {/* Action Buttons */}
            <BlurFade delay={0.65}>
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardContent className="p-4 space-y-3">
                  <Button
                    type="submit"
                    disabled={isSubmitting || !formData.customerId || !formData.packageId}
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
                        Hizmeti Kaydet
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/yonetim/hizmetler")}
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
