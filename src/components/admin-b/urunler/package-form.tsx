"use client";

/**
 * Shared body of the admin "Yeni paket" and "Paketi düzenle" editors.
 * Layout follows shadcnblocks `edit-product1`: main column (info, pricing
 * matrix, features, limits) + a dashed side rail (status, stock, SEO).
 *
 * State lives in the page (it owns submit + validation); this component only
 * renders fields and applies local edits through `setFormData`.
 */

import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Infinity as InfinityIcon, Plus, Star, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, FormField, SectionCard, appButton } from "@/components/app";
import { cn } from "@/lib/utils";
import {
  billingPeriodConfig,
  categoryConfig,
  resourceLimitLabels,
} from "@/lib/products/constants";
import type { BillingPeriod, ProductFormData } from "@/types/products";

export type PackageFormSection = "basic" | "pricing" | "features" | "limits" | "configuration" | "settings";

export const packageSectionId = (section: PackageFormSection) => `paket-${section}`;

/** Scrolls a section into view (used instead of switching tabs on validation errors). */
export function focusPackageSection(section: PackageFormSection) {
  if (typeof document === "undefined") return;
  document.getElementById(packageSectionId(section))?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export const categoryOptions = Object.entries(categoryConfig).map(([slug, config]) => ({
  value: slug,
  label: config.name,
}));

export const billingPeriods = Object.entries(billingPeriodConfig).map(([key, config]) => ({
  value: key as BillingPeriod,
  label: config.label,
  months: config.months,
  discount: config.discount,
}));

export const defaultPricingTier = {
  period: "monthly" as BillingPeriod,
  price: 0,
  setupFee: 0,
  renewalPrice: 0,
  isDefault: false,
  isActive: true,
};

export const generateSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const control = "h-11 md:h-9";

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium leading-none">
          {label}
        </label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/** Small segmented "∞" / "Sınırsız" toggle next to numeric inputs. */
function UnlimitedToggle({
  active,
  onToggle,
  label,
  compact = false,
}: {
  active: boolean;
  onToggle: () => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={compact ? label : undefined}
      title={label}
      onClick={onToggle}
      className={appButton({
        variant: active ? "primary" : "outline",
        size: compact ? "icon" : "md",
        className: "shrink-0",
      })}
    >
      {compact ? <InfinityIcon aria-hidden /> : "Sınırsız"}
    </button>
  );
}

export function PackageFormFields({
  mode,
  formData,
  setFormData,
  configuration,
}: {
  mode: "create" | "edit";
  formData: ProductFormData;
  setFormData: Dispatch<SetStateAction<ProductFormData>>;
  /** Extra section rendered after limits (edit: product config options). */
  configuration?: ReactNode;
}) {
  const isCreate = mode === "create";
  const [includedFeatureInput, setIncludedFeatureInput] = useState("");

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({ ...prev, name, slug: generateSlug(name) }));
  };

  const handleAddPricingTier = () => {
    const usedPeriods = formData.pricingTiers.map((t) => t.period);
    const availablePeriod = billingPeriods.find((p) => !usedPeriods.includes(p.value));
    if (availablePeriod) {
      setFormData((prev) => ({
        ...prev,
        pricingTiers: [...prev.pricingTiers, { ...defaultPricingTier, period: availablePeriod.value }],
      }));
    }
  };

  const handleRemovePricingTier = (index: number) => {
    setFormData((prev) => ({ ...prev, pricingTiers: prev.pricingTiers.filter((_, i) => i !== index) }));
  };

  const handlePricingTierChange = (index: number, field: string, value: string | number | boolean) => {
    setFormData((prev) => ({
      ...prev,
      pricingTiers: prev.pricingTiers.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier)),
    }));
  };

  const handleResourceLimitChange = (key: string, value: number) => {
    setFormData((prev) => ({ ...prev, resourceLimits: { ...prev.resourceLimits, [key]: value } }));
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
    setFormData((prev) => ({ ...prev, includedFeatures: prev.includedFeatures.filter((_, i) => i !== index) }));
  };

  return (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
      {/* Main column */}
      <div className="flex min-w-0 flex-col gap-6">
        <SectionCard
          id={packageSectionId("basic")}
          title="Temel bilgiler"
          description="Paketin adı, kategorisi ve açıklaması."
          className="scroll-mt-24"
        >
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <FormField label="Kategori" htmlFor="category" required>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, categoryId: value }))}
                >
                  <SelectTrigger id="category" className={control}>
                    <SelectValue placeholder="Kategori seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="SKU" htmlFor="sku" required hint="Büyük harfe çevrilir.">
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value.toUpperCase() }))}
                  placeholder={isCreate ? "Örn: HST-PRO-01" : undefined}
                  className={cn(control, "font-mono uppercase")}
                />
              </FormField>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <FormField label="Paket adı" htmlFor="name" required>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={isCreate ? "Örn: Pro Hosting" : undefined}
                  className={control}
                />
              </FormField>
              <FormField label="Slug" htmlFor="slug" required hint="Paket adından otomatik üretilir.">
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder={isCreate ? "pro-hosting" : undefined}
                  className={cn(control, "font-mono")}
                />
              </FormField>
            </div>
            <FormField label="Kısa açıklama" htmlFor="shortDescription" required={isCreate}>
              <Input
                id="shortDescription"
                value={formData.shortDescription}
                onChange={(e) => setFormData((prev) => ({ ...prev, shortDescription: e.target.value }))}
                placeholder={isCreate ? "Profesyonel projeler için güçlü hosting" : undefined}
                className={control}
              />
            </FormField>
            <FormField label="Detaylı açıklama" htmlFor="longDescription">
              <Textarea
                id="longDescription"
                value={formData.longDescription}
                onChange={(e) => setFormData((prev) => ({ ...prev, longDescription: e.target.value }))}
                placeholder={isCreate ? "Paketin detaylı açıklaması…" : undefined}
                className="min-h-[120px] resize-y"
              />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard
          id={packageSectionId("pricing")}
          title="Fiyatlandırma"
          description="Her faturalama dönemi için fiyat, kurulum ve yenileme ücreti. Varsayılan dönem taban fiyatı belirler."
          className="scroll-mt-24"
          actions={
            <button
              type="button"
              onClick={handleAddPricingTier}
              disabled={formData.pricingTiers.length >= billingPeriods.length}
              className={appButton({ variant: "outline", size: "sm" })}
            >
              <Plus aria-hidden />
              Dönem ekle
            </button>
          }
        >
          {formData.pricingTiers.length === 0 ? (
            <EmptyState compact title="Fiyat dönemi yok" description="En az bir fiyat dönemi ekleyin." />
          ) : (
            <ul className="space-y-3">
              {formData.pricingTiers.map((tier, index) => {
                const periodConf = billingPeriodConfig[tier.period];
                const rowId = `tier-${index}`;
                return (
                  <li key={index} className="rounded-lg border bg-muted/20 p-3 md:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={tier.period}
                          onValueChange={(value) => handlePricingTierChange(index, "period", value)}
                        >
                          <SelectTrigger aria-label="Faturalama dönemi" className={cn(control, "w-[150px] bg-background")}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {billingPeriods.map((period) => (
                              <SelectItem
                                key={period.value}
                                value={period.value}
                                disabled={formData.pricingTiers.some((t, i) => i !== index && t.period === period.value)}
                              >
                                {period.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {tier.isDefault ? (
                          <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs font-medium">
                            <Star aria-hidden className="size-3" />
                            Varsayılan
                          </span>
                        ) : null}
                        {periodConf && periodConf.discount > 0 ? (
                          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                            %{periodConf.discount} indirimli
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1">
                        {!tier.isDefault ? (
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                pricingTiers: prev.pricingTiers.map((t, i) => ({ ...t, isDefault: i === index })),
                              }))
                            }
                            className={appButton({ variant: "ghost", size: "sm" })}
                          >
                            Varsayılan yap
                          </button>
                        ) : null}
                        {formData.pricingTiers.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => handleRemovePricingTier(index)}
                            aria-label={`${periodConf?.label ?? tier.period} dönemini kaldır`}
                            className={appButton({
                              variant: "ghost",
                              size: "icon-sm",
                              className: "text-red-600 hover:bg-red-500/10 dark:text-red-400",
                            })}
                          >
                            <Trash2 aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end">
                      <FormField label="Fiyat (₺)" htmlFor={`${rowId}-price`}>
                        <Input
                          id={`${rowId}-price`}
                          type="number"
                          inputMode="decimal"
                          value={tier.price}
                          onChange={(e) => handlePricingTierChange(index, "price", parseFloat(e.target.value) || 0)}
                          className={cn(control, "bg-background tabular-nums")}
                        />
                      </FormField>
                      <FormField label="Kurulum ücreti (₺)" htmlFor={`${rowId}-setup`}>
                        <Input
                          id={`${rowId}-setup`}
                          type="number"
                          inputMode="decimal"
                          value={tier.setupFee}
                          onChange={(e) => handlePricingTierChange(index, "setupFee", parseFloat(e.target.value) || 0)}
                          className={cn(control, "bg-background tabular-nums")}
                        />
                      </FormField>
                      <FormField label="Yenileme fiyatı (₺)" htmlFor={`${rowId}-renewal`}>
                        <Input
                          id={`${rowId}-renewal`}
                          type="number"
                          inputMode="decimal"
                          value={tier.renewalPrice || tier.price}
                          onChange={(e) =>
                            handlePricingTierChange(index, "renewalPrice", parseFloat(e.target.value) || 0)
                          }
                          className={cn(control, "bg-background tabular-nums")}
                        />
                      </FormField>
                      <div className="flex h-11 items-center gap-2 md:h-9">
                        <Switch
                          id={`${rowId}-active`}
                          checked={tier.isActive}
                          onCheckedChange={(checked) => handlePricingTierChange(index, "isActive", checked)}
                        />
                        <label htmlFor={`${rowId}-active`} className="text-sm">
                          Aktif
                        </label>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          id={packageSectionId("features")}
          title="Dahil özellikler"
          description="Paket kartında madde olarak gösterilir."
          className="scroll-mt-24"
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                aria-label="Yeni özellik"
                value={includedFeatureInput}
                onChange={(e) => setIncludedFeatureInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddIncludedFeature();
                  }
                }}
                placeholder="Örn: cPanel kontrol paneli, ücretsiz SSL…"
                className={cn(control, "flex-1")}
              />
              <button type="button" onClick={handleAddIncludedFeature} className={appButton({ variant: "outline" })}>
                <Plus aria-hidden />
                <span className="hidden sm:inline">Ekle</span>
                <span className="sr-only sm:hidden">Özellik ekle</span>
              </button>
            </div>
            {formData.includedFeatures.length === 0 ? (
              <EmptyState
                compact
                title="Henüz özellik eklenmedi"
                description={isCreate ? "Yukarıdaki alandan özellik ekleyin." : undefined}
              />
            ) : (
              <ul className="flex flex-wrap gap-2">
                {formData.includedFeatures.map((feature, index) => (
                  <li
                    key={index}
                    className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-1 pl-3 pr-1 text-sm"
                  >
                    {feature}
                    <button
                      type="button"
                      onClick={() => handleRemoveIncludedFeature(index)}
                      aria-label={`${feature} özelliğini kaldır`}
                      className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X aria-hidden className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SectionCard>

        <SectionCard
          id={packageSectionId("limits")}
          title="Kaynak limitleri"
          description="Sınırsız için ∞ düğmesini kullanın (-1 olarak kaydedilir)."
          className="scroll-mt-24"
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(resourceLimitLabels).map(([key, config]) => {
              const value = formData.resourceLimits[key as keyof typeof formData.resourceLimits];
              const numValue = typeof value === "number" ? value : 0;
              const fieldId = `limit-${key}`;
              return (
                <FormField
                  key={key}
                  htmlFor={fieldId}
                  label={
                    <>
                      {config.label}{" "}
                      <span className="font-normal text-muted-foreground">({config.unit})</span>
                    </>
                  }
                >
                  <div className="flex items-center gap-2">
                    <Input
                      id={fieldId}
                      type="number"
                      value={numValue}
                      onChange={(e) => handleResourceLimitChange(key, parseInt(e.target.value) || 0)}
                      className={cn(control, "tabular-nums")}
                    />
                    <UnlimitedToggle
                      compact
                      label={`${config.label}: sınırsız`}
                      active={numValue === -1}
                      onToggle={() => handleResourceLimitChange(key, numValue === -1 ? 0 : -1)}
                    />
                  </div>
                </FormField>
              );
            })}
          </div>
        </SectionCard>

        {configuration ? (
          <div id={packageSectionId("configuration")} className="scroll-mt-24">
            {configuration}
          </div>
        ) : null}
      </div>

      {/* Side rail */}
      <div
        id={packageSectionId("settings")}
        className="flex min-w-0 scroll-mt-24 flex-col gap-4 rounded-xl border border-dashed bg-muted/30 p-2 md:p-3 xl:sticky xl:top-20"
      >
        <SectionCard title="Durum ve görünürlük" headingLevel={3}>
          <div className="space-y-5">
            <FormField label="Durum" htmlFor="status">
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, status: value as "active" | "inactive" | "draft" | "archived" }))
                }
              >
                <SelectTrigger id="status" className={control}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Taslak</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="inactive">Pasif</SelectItem>
                  <SelectItem value="archived">Arşivlenmiş</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <ToggleRow
              id="isVisible"
              label="Sitede görünür"
              hint="Kapalıysa paket listelerde gösterilmez."
              checked={formData.isVisible}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isVisible: checked }))}
            />
            <ToggleRow
              id="isPopular"
              label="Popüler olarak işaretle"
              checked={formData.isPopular}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isPopular: checked }))}
            />
          </div>
        </SectionCard>

        <SectionCard title="Stok ve sıralama" headingLevel={3}>
          <div className="space-y-5">
            <FormField
              label="Stok miktarı"
              htmlFor="stockQuantity"
              hint={
                isCreate
                  ? formData.stockQuantity === -1
                    ? "Sınırsız stok"
                    : `Kalan: ${formData.stockQuantity} adet`
                  : undefined
              }
            >
              <div className="flex items-center gap-2">
                <Input
                  id="stockQuantity"
                  type="number"
                  value={formData.stockQuantity}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, stockQuantity: parseInt(e.target.value) || 0 }))
                  }
                  className={cn(control, "tabular-nums")}
                />
                <UnlimitedToggle
                  label="Sınırsız stok"
                  active={formData.stockQuantity === -1}
                  onToggle={() =>
                    setFormData((prev) => ({ ...prev, stockQuantity: prev.stockQuantity === -1 ? 0 : -1 }))
                  }
                />
              </div>
            </FormField>
            <FormField label="Etiket (badge)" htmlFor="badge" hint="Paket kartında öne çıkan kısa etiket.">
              <Input
                id="badge"
                value={formData.badge || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, badge: e.target.value }))}
                placeholder="Örn: POPÜLER, YENİ"
                className={control}
              />
            </FormField>
            <FormField label="Sıralama" htmlFor="displayOrder" hint="Küçük sayı önce gösterilir.">
              <Input
                id="displayOrder"
                type="number"
                value={formData.displayOrder}
                onChange={(e) => setFormData((prev) => ({ ...prev, displayOrder: parseInt(e.target.value) || 1 }))}
                className={cn(control, "tabular-nums")}
              />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title="SEO" headingLevel={3}>
          <div className="space-y-5">
            <FormField label="Meta başlık" htmlFor="metaTitle">
              <Input
                id="metaTitle"
                value={formData.metaTitle || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, metaTitle: e.target.value }))}
                placeholder={isCreate ? "Pro Hosting Paketi | KLEACORE" : undefined}
                className={control}
              />
            </FormField>
            <FormField label="Meta açıklama" htmlFor="metaDescription">
              <Textarea
                id="metaDescription"
                value={formData.metaDescription || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, metaDescription: e.target.value }))}
                placeholder={isCreate ? "Profesyonel projeler için güçlü hosting çözümü…" : undefined}
                className="resize-y"
                rows={3}
              />
            </FormField>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
