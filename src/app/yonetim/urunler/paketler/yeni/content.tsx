"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Save } from "lucide-react";
import { PageHeader, UnavailableAction, appButton } from "@/components/app";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  PackageFormFields,
  defaultPricingTier,
  focusPackageSection,
} from "@/components/admin-b/urunler/package-form";
import { defaultResourceLimits } from "@/lib/products/constants";
import type { ProductFormData } from "@/types/products";
import { createProduct } from "@/lib/actions/admin/products";
import { toast } from "@/lib/toast";

export function NewPackageContent() {
  const router = useRouter();
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
    pricingTiers: [{ ...defaultPricingTier, isDefault: true }],
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

  const handleSubmit = () => {
    const statusMap = {
      active: "ACTIVE" as const,
      inactive: "INACTIVE" as const,
      draft: "DRAFT" as const,
      archived: "ARCHIVED" as const,
    };

    if (isSubmitting) return;

    if (!formData.categoryId) {
      focusPackageSection("basic");
      toast.error("Lütfen bir kategori seçin.");
      return;
    }

    if (!formData.sku.trim() || !formData.name.trim() || !formData.slug.trim()) {
      focusPackageSection("basic");
      toast.error("Kategori, SKU, paket adı ve slug zorunludur.");
      return;
    }

    if (!formData.shortDescription.trim()) {
      focusPackageSection("basic");
      toast.error("Kısa açıklama zorunludur.");
      return;
    }

    if (formData.pricingTiers.length === 0) {
      focusPackageSection("pricing");
      toast.error("En az bir fiyat dönemi eklemelisiniz.");
      return;
    }

    const hasPositivePrice = formData.pricingTiers.some((tier) => tier.price > 0);
    if (!hasPositivePrice) {
      focusPackageSection("pricing");
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

    const defaultTier = normalizedPricingTiers.find((tier) => tier.isDefault) ?? normalizedPricingTiers[0];

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

  const saveButton = (
    <button type="button" onClick={handleSubmit} disabled={isSubmitting} className={appButton()}>
      {isSubmitting ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
      {isSubmitting ? "Kaydediliyor…" : "Kaydet"}
    </button>
  );

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/urunler/paketler", label: "Paketler" }}
        eyebrow="Ürün kataloğu"
        title="Yeni paket"
        description="Yeni bir ürün veya paket oluşturun. Paket taslak olarak kaydedilir; durumu yan panelden değiştirebilirsiniz."
        actions={
          <>
            {/* Local provider: harmless inside AppShell's, needed under shells without one. */}
            <TooltipProvider>
              <UnavailableAction label="Önizle" icon={<Eye aria-hidden />} variant="outline" reason="Yakında" />
            </TooltipProvider>
            {saveButton}
          </>
        }
      />

      <PackageFormFields mode="create" formData={formData} setFormData={setFormData} />

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Link href="/yonetim/urunler/paketler" className={appButton({ variant: "ghost" })}>
          Vazgeç
        </Link>
        {saveButton}
      </div>
    </>
  );
}
