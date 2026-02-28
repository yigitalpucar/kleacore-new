"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Eye,
  Plus,
  Trash2,
  Info,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import {
  categoryConfig,
  billingPeriodConfig,
  defaultResourceLimits,
  resourceLimitLabels,
} from "@/lib/products/constants";
import type { ProductFormData, ProductCategorySlug, BillingPeriod } from "@/types/products";
import { createProduct } from "@/lib/actions/admin/products";
import { toast } from "@/lib/toast";

const categoryOptions = Object.entries(categoryConfig).map(([slug, config]) => ({
  value: slug,
  label: config.name,
  icon: config.icon,
  color: config.color,
}));

const billingPeriods = Object.entries(billingPeriodConfig).map(([key, config]) => ({
  value: key as BillingPeriod,
  label: config.label,
  months: config.months,
  discount: config.discount,
}));

const defaultPricingTier = {
  period: "monthly" as BillingPeriod,
  price: 0,
  setupFee: 0,
  renewalPrice: 0,
  isDefault: false,
  isActive: true,
};

export default function NewPackagePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("basic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>({
    categoryId: "",
    sku: "",
    name: "",
    slug: "",
    shortDescription: "",
    longDescription: "",
    features: [],
    includedFeatures: [],
    resourceLimits: { ...defaultResourceLimits },
    pricingTiers: [
      { ...defaultPricingTier, isDefault: true },
    ],
    badge: "",
    isPopular: false,
    displayOrder: 1,
    stockQuantity: -1,
    upgradeToProducts: [],
    downgradeToProducts: [],
    status: "draft",
    isVisible: true,
    metaTitle: "",
    metaDescription: "",
  });

  const [includedFeatureInput, setIncludedFeatureInput] = useState("");

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: generateSlug(name),
    }));
  };

  const handleAddPricingTier = () => {
    const usedPeriods = formData.pricingTiers.map((t) => t.period);
    const availablePeriod = billingPeriods.find(
      (p) => !usedPeriods.includes(p.value)
    );

    if (availablePeriod) {
      setFormData((prev) => ({
        ...prev,
        pricingTiers: [
          ...prev.pricingTiers,
          { ...defaultPricingTier, period: availablePeriod.value },
        ],
      }));
    }
  };

  const handleRemovePricingTier = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      pricingTiers: prev.pricingTiers.filter((_, i) => i !== index),
    }));
  };

  const handlePricingTierChange = (
    index: number,
    field: string,
    value: string | number | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      pricingTiers: prev.pricingTiers.map((tier, i) =>
        i === index ? { ...tier, [field]: value } : tier
      ),
    }));
  };

  const handleResourceLimitChange = (key: string, value: number) => {
    setFormData((prev) => ({
      ...prev,
      resourceLimits: {
        ...prev.resourceLimits,
        [key]: value,
      },
    }));
  };

  const handleAddIncludedFeature = () => {
    if (includedFeatureInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        includedFeatures: [...prev.includedFeatures, includedFeatureInput.trim()],
      }));
      setIncludedFeatureInput("");
    }
  };

  const handleRemoveIncludedFeature = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      includedFeatures: prev.includedFeatures.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = () => {
    const statusMap = {
      active: "ACTIVE" as const,
      inactive: "INACTIVE" as const,
      draft: "DRAFT" as const,
      archived: "ARCHIVED" as const,
    };

    if (isSubmitting) return;

    if (!formData.categoryId) {
      setActiveTab("basic");
      toast.error("Lütfen bir kategori seçin.");
      return;
    }

    if (!formData.sku.trim() || !formData.name.trim() || !formData.slug.trim()) {
      setActiveTab("basic");
      toast.error("Kategori, SKU, paket adı ve slug zorunludur.");
      return;
    }

    if (!formData.shortDescription.trim()) {
      setActiveTab("basic");
      toast.error("Kısa açıklama zorunludur.");
      return;
    }

    if (formData.pricingTiers.length === 0) {
      setActiveTab("pricing");
      toast.error("En az bir fiyat dönemi eklemelisiniz.");
      return;
    }

    const hasPositivePrice = formData.pricingTiers.some((tier) => tier.price > 0);
    if (!hasPositivePrice) {
      setActiveTab("pricing");
      toast.error("En az bir fiyat dönemi için fiyat 0'dan büyük olmalıdır.");
      return;
    }

    const hasDefaultTier = formData.pricingTiers.some((tier) => tier.isDefault);
    const normalizedPricingTiers = formData.pricingTiers.map((tier, index) => ({
      period: tier.period,
      price: tier.price,
      setupFee: tier.setupFee || 0,
      renewalPrice: tier.renewalPrice || tier.price,
      isDefault: hasDefaultTier ? tier.isDefault : index === 0,
      isActive: tier.isActive,
    }));

    const defaultTier = normalizedPricingTiers.find((tier) => tier.isDefault)
      ?? normalizedPricingTiers[0];

    const submit = async () => {
      setIsSubmitting(true);

      try {
        const result = await createProduct({
          categoryId: formData.categoryId,
          sku: formData.sku.trim().toUpperCase(),
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          shortDescription: formData.shortDescription.trim(),
          longDescription: formData.longDescription.trim(),
          features: formData.features,
          includedFeatures: formData.includedFeatures
            .map((feature) => feature.trim())
            .filter((feature) => feature.length > 0),
          resourceLimits: formData.resourceLimits,
          basePrice: defaultTier.price,
          badge: formData.badge?.trim() || undefined,
          isPopular: formData.isPopular,
          displayOrder: formData.displayOrder,
          stockQuantity: formData.stockQuantity,
          status: statusMap[formData.status],
          isVisible: formData.isVisible,
          metaTitle: formData.metaTitle?.trim() || undefined,
          metaDescription: formData.metaDescription?.trim() || undefined,
          pricingTiers: normalizedPricingTiers,
        });

        if (!result.success) {
          toast.error(result.error ?? "Paket oluşturulamadı.");
          return;
        }

        toast.success("Paket başarıyla oluşturuldu.");
        router.push("/yonetim/urunler/paketler");
      } finally {
        setIsSubmitting(false);
      }
    };

    void submit();
  };

  const selectedCategory = categoryOptions.find(
    (c) => c.value === formData.categoryId
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/yonetim/urunler/paketler">
              <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Yeni Paket</h1>
              <p className="text-zinc-400">Yeni bir ürün veya paket oluşturun</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              <Eye className="mr-2 h-4 w-4" />
              Önizle
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </BlurFade>

      {/* Form Tabs */}
      <BlurFade delay={0.1}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-zinc-900 border border-zinc-800 grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="basic" className="data-[state=active]:bg-zinc-800">
              Temel Bilgiler
            </TabsTrigger>
            <TabsTrigger value="pricing" className="data-[state=active]:bg-zinc-800">
              Fiyatlandırma
            </TabsTrigger>
            <TabsTrigger value="features" className="data-[state=active]:bg-zinc-800">
              Özellikler
            </TabsTrigger>
            <TabsTrigger value="limits" className="data-[state=active]:bg-zinc-800">
              Limitler
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-zinc-800">
              Ayarlar
            </TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Temel Bilgiler</CardTitle>
                <CardDescription className="text-zinc-400">
                  Paketin adı, kategorisi ve açıklaması
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="category" className="text-zinc-300">
                      Kategori <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.categoryId}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, categoryId: value }))
                      }
                    >
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue placeholder="Kategori seçin" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        {categoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <div className={cn("p-1 rounded", option.color)}>
                                {option.icon && <option.icon className="h-3 w-3" />}
                              </div>
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sku" className="text-zinc-300">
                      SKU (Ürün Kodu) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, sku: e.target.value.toUpperCase() }))
                      }
                      placeholder="Örn: HST-PRO-01"
                      className="bg-zinc-800 border-zinc-700 text-white uppercase"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-zinc-300">
                      Paket Adı <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Örn: Pro Hosting"
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="slug" className="text-zinc-300">
                      Slug (URL)
                    </Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, slug: e.target.value }))
                      }
                      placeholder="pro-hosting"
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="shortDescription" className="text-zinc-300">
                    Kısa Açıklama <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="shortDescription"
                    value={formData.shortDescription}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, shortDescription: e.target.value }))
                    }
                    placeholder="Profesyonel projeler için güçlü hosting"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="longDescription" className="text-zinc-300">
                    Detaylı Açıklama
                  </Label>
                  <Textarea
                    id="longDescription"
                    value={formData.longDescription}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, longDescription: e.target.value }))
                    }
                    placeholder="Paketin detaylı açıklaması..."
                    className="bg-zinc-800 border-zinc-700 text-white min-h-[120px] resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white">Fiyatlandırma</CardTitle>
                  <CardDescription className="text-zinc-400">
                    Farklı dönemler için fiyat belirleyin
                  </CardDescription>
                </div>
                <Button
                  onClick={handleAddPricingTier}
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  disabled={formData.pricingTiers.length >= billingPeriods.length}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Dönem Ekle
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {formData.pricingTiers.map((tier, index) => {
                    const periodConf = billingPeriodConfig[tier.period];
                    return (
                      <div
                        key={index}
                        className="p-4 rounded-lg border border-zinc-800 bg-zinc-800/50 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Select
                              value={tier.period}
                              onValueChange={(value) =>
                                handlePricingTierChange(index, "period", value)
                              }
                            >
                              <SelectTrigger className="w-[140px] bg-zinc-800 border-zinc-700 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-zinc-900 border-zinc-800">
                                {billingPeriods.map((period) => (
                                  <SelectItem
                                    key={period.value}
                                    value={period.value}
                                    disabled={
                                      formData.pricingTiers.some(
                                        (t, i) => i !== index && t.period === period.value
                                      )
                                    }
                                  >
                                    {period.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {tier.isDefault && (
                              <Badge variant="outline" className="border-primary text-primary">
                                Varsayılan
                              </Badge>
                            )}
                            {periodConf.discount > 0 && (
                              <Badge className="bg-green-500/10 text-green-500">
                                %{periodConf.discount} İndirimli
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!tier.isDefault && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    pricingTiers: prev.pricingTiers.map((t, i) => ({
                                      ...t,
                                      isDefault: i === index,
                                    })),
                                  }))
                                }
                                className="text-zinc-400 hover:text-white"
                              >
                                Varsayılan Yap
                              </Button>
                            )}
                            {formData.pricingTiers.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemovePricingTier(index)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="grid gap-2">
                            <Label className="text-zinc-400 text-xs">
                              Fiyat (₺)
                            </Label>
                            <Input
                              type="number"
                              value={tier.price}
                              onChange={(e) =>
                                handlePricingTierChange(
                                  index,
                                  "price",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="bg-zinc-800 border-zinc-700 text-white"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-zinc-400 text-xs">
                              Kurulum Ücreti (₺)
                            </Label>
                            <Input
                              type="number"
                              value={tier.setupFee}
                              onChange={(e) =>
                                handlePricingTierChange(
                                  index,
                                  "setupFee",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="bg-zinc-800 border-zinc-700 text-white"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-zinc-400 text-xs">
                              Yenileme Fiyatı (₺)
                            </Label>
                            <Input
                              type="number"
                              value={tier.renewalPrice || tier.price}
                              onChange={(e) =>
                                handlePricingTierChange(
                                  index,
                                  "renewalPrice",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="bg-zinc-800 border-zinc-700 text-white"
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={tier.isActive}
                                onCheckedChange={(checked) =>
                                  handlePricingTierChange(index, "isActive", checked)
                                }
                                className="data-[state=checked]:bg-primary"
                              />
                              <Label className="text-zinc-400 text-xs">Aktif</Label>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="space-y-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Dahil Özellikler</CardTitle>
                <CardDescription className="text-zinc-400">
                  Bu pakete dahil olan özellikleri listeleyin
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={includedFeatureInput}
                    onChange={(e) => setIncludedFeatureInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddIncludedFeature();
                      }
                    }}
                    placeholder="Örn: cPanel Kontrol Paneli, Ücretsiz SSL..."
                    className="bg-zinc-800 border-zinc-700 text-white flex-1"
                  />
                  <Button
                    onClick={handleAddIncludedFeature}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.includedFeatures.map((feature, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="bg-zinc-800 text-zinc-300 gap-2 py-1.5"
                    >
                      {feature}
                      <button
                        onClick={() => handleRemoveIncludedFeature(index)}
                        className="text-zinc-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>

                {formData.includedFeatures.length === 0 && (
                  <div className="text-center py-8 text-zinc-500">
                    <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Henüz özellik eklenmedi</p>
                    <p className="text-xs">Yukarıdaki alandan özellik ekleyin</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Limits Tab */}
          <TabsContent value="limits" className="space-y-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Kaynak Limitleri</CardTitle>
                <CardDescription className="text-zinc-400">
                  Paketin kaynak limitlerini belirleyin. -1 = Sınırsız
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(resourceLimitLabels).map(([key, config]) => {
                    const value = formData.resourceLimits[key as keyof typeof formData.resourceLimits];
                    const Icon = config.icon;
                    const numValue = typeof value === "number" ? value : 0;

                    return (
                      <div key={key} className="grid gap-2">
                        <Label className="text-zinc-300 flex items-center gap-2">
                          <Icon className="h-4 w-4 text-zinc-500" />
                          {config.label}
                          <span className="text-xs text-zinc-500">({config.unit})</span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={numValue}
                            onChange={(e) =>
                              handleResourceLimitChange(key, parseInt(e.target.value) || 0)
                            }
                            className="bg-zinc-800 border-zinc-700 text-white"
                          />
                          <Button
                            type="button"
                            variant={numValue === -1 ? "default" : "outline"}
                            size="sm"
                            onClick={() =>
                              handleResourceLimitChange(key, numValue === -1 ? 0 : -1)
                            }
                            className={cn(
                              "shrink-0",
                              numValue === -1
                                ? "bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/50"
                                : "border-zinc-700 text-zinc-400"
                            )}
                          >
                            ∞
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white">Görünüm</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="badge" className="text-zinc-300">
                      Etiket (Badge)
                    </Label>
                    <Input
                      id="badge"
                      value={formData.badge || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, badge: e.target.value }))
                      }
                      placeholder="Örn: POPÜLER, YENİ"
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="isPopular" className="text-zinc-300">
                      Popüler olarak işaretle
                    </Label>
                    <Switch
                      id="isPopular"
                      checked={formData.isPopular}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, isPopular: checked }))
                      }
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="isVisible" className="text-zinc-300">
                      Sitede görünür
                    </Label>
                    <Switch
                      id="isVisible"
                      checked={formData.isVisible}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, isVisible: checked }))
                      }
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="displayOrder" className="text-zinc-300">
                      Sıralama
                    </Label>
                    <Input
                      id="displayOrder"
                      type="number"
                      value={formData.displayOrder}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          displayOrder: parseInt(e.target.value) || 1,
                        }))
                      }
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white">Stok & Durum</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="status" className="text-zinc-300">
                      Durum
                    </Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          status: value as "active" | "inactive" | "draft" | "archived",
                        }))
                      }
                    >
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="draft">Taslak</SelectItem>
                        <SelectItem value="active">Aktif</SelectItem>
                        <SelectItem value="inactive">Pasif</SelectItem>
                        <SelectItem value="archived">Arşivlenmiş</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="stockQuantity" className="text-zinc-300">
                      Stok Miktarı
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="stockQuantity"
                        type="number"
                        value={formData.stockQuantity}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            stockQuantity: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="bg-zinc-800 border-zinc-700 text-white"
                      />
                      <Button
                        type="button"
                        variant={formData.stockQuantity === -1 ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            stockQuantity: prev.stockQuantity === -1 ? 0 : -1,
                          }))
                        }
                        className={cn(
                          "shrink-0",
                          formData.stockQuantity === -1
                            ? "bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/50"
                            : "border-zinc-700 text-zinc-400"
                        )}
                      >
                        Sınırsız
                      </Button>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {formData.stockQuantity === -1
                        ? "Sınırsız stok"
                        : `Kalan: ${formData.stockQuantity} adet`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">SEO Ayarları</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="metaTitle" className="text-zinc-300">
                    Meta Başlık
                  </Label>
                  <Input
                    id="metaTitle"
                    value={formData.metaTitle || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, metaTitle: e.target.value }))
                    }
                    placeholder="Pro Hosting Paketi | KLEACORE"
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="metaDescription" className="text-zinc-300">
                    Meta Açıklama
                  </Label>
                  <Textarea
                    id="metaDescription"
                    value={formData.metaDescription || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, metaDescription: e.target.value }))
                    }
                    placeholder="Profesyonel projeler için güçlü hosting çözümü..."
                    className="bg-zinc-800 border-zinc-700 text-white resize-none"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </BlurFade>
    </div>
  );
}
