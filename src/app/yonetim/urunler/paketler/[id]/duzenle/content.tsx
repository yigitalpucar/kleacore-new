"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Save } from "lucide-react";
import { PageHeader, StatusBadge, appButton } from "@/components/app";
import { PackageFormFields, focusPackageSection } from "@/components/admin-b/urunler/package-form";
import { defaultResourceLimits } from "@/lib/products/constants";
import type { ProductFormData, BillingPeriod } from "@/types/products";
import { updateProduct } from "@/lib/actions/admin/products";
import { ProductConfigOptionsSection } from "@/components/admin/product-config-options-section";
import { toast } from "@/lib/toast";
import type { ProductConfigOption as ProductConfigOptionRow } from "@prisma/client";
import type { Serialized } from "@/lib/money";

/** Config option as sent to the browser (unit prices are numbers). */
type ProductConfigOption = Serialized<ProductConfigOptionRow>;

interface ProductWithRelations {
  id: string;
  sku: string;
  name: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  features: unknown;
  includedFeatures: unknown;
  resourceLimits: unknown;
  basePrice: number;
  badge: string | null;
  isPopular: boolean;
  displayOrder: number;
  stockQuantity: number;
  isInStock: boolean;
  status: string;
  isVisible: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    slug: string;
    name: string;
  };
  pricingTiers: {
    id: string;
    productId: string;
    period: string;
    price: number;
    discountedPrice: number | null;
    setupFee: number;
    renewalPrice: number;
    isDefault: boolean;
    isActive: boolean;
  }[];
}

interface EditPackageContentProps {
  product: ProductWithRelations;
  configOptions: ProductConfigOption[];
}

interface EditPackageContentProps {
  product: ProductWithRelations;
  configOptions: ProductConfigOption[];
}

export const EditPackageContent = ({ product, configOptions }: EditPackageContentProps) => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const existingResourceLimits = (
    product.resourceLimits && typeof product.resourceLimits === "object" && !Array.isArray(product.resourceLimits)
      ? product.resourceLimits
      : {}
  ) as Record<string, number | string>;

  const [formData, setFormData] = useState<ProductFormData>({
    categoryId: product.category.slug,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    longDescription: product.longDescription,
    features: Array.isArray(product.features) ? product.features : [],
    includedFeatures: Array.isArray(product.includedFeatures)
      ? (product.includedFeatures as string[])
      : [],
    resourceLimits: { ...defaultResourceLimits, ...existingResourceLimits },
    pricingTiers: product.pricingTiers.map((tier) => ({
      period: tier.period as BillingPeriod,
      price: tier.price,
      setupFee: tier.setupFee,
      renewalPrice: tier.renewalPrice,
      isDefault: tier.isDefault,
      isActive: tier.isActive,
    })),
    badge: product.badge ?? "",
    isPopular: product.isPopular,
    displayOrder: product.displayOrder,
    stockQuantity: product.stockQuantity,
    upgradeToProducts: [],
    downgradeToProducts: [],
    status: product.status.toLowerCase() as "active" | "inactive" | "draft" | "archived",
    isVisible: product.isVisible,
    metaTitle: product.metaTitle ?? "",
    metaDescription: product.metaDescription ?? "",
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

    if (formData.pricingTiers.length === 0) {
      focusPackageSection("pricing");
      toast.error("En az bir fiyat dönemi eklemelisiniz.");
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
        const result = await updateProduct(product.id, {
          categoryId: formData.categoryId,
          sku: formData.sku.trim().toUpperCase(),
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          shortDescription: formData.shortDescription.trim(),
          longDescription: formData.longDescription.trim(),
          features: formData.features,
          includedFeatures: formData.includedFeatures
            .map((f) => f.trim())
            .filter((f) => f.length > 0),
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
          toast.error(result.error ?? "Paket güncellenemedi.");
          return;
        }

        toast.success("Paket başarıyla güncellendi.");
        router.push(`/yonetim/urunler/paketler/${product.id}`);
      } finally {
        setIsSubmitting(false);
      }
    };

    void submit();
  };

  const detailHref = `/yonetim/urunler/paketler/${product.id}`;
  const saveButton = (
    <button type="button" onClick={handleSubmit} disabled={isSubmitting} className={appButton()}>
      {isSubmitting ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
      {isSubmitting ? "Kaydediliyor…" : "Güncelle"}
    </button>
  );

  return (
    <>
      <PageHeader
        back={{ href: detailHref, label: product.name }}
        eyebrow={<span className="normal-case tracking-normal">{product.sku}</span>}
        title="Paketi düzenle"
        description={product.name}
        meta={<StatusBadge kind="product" status={product.status} />}
        actions={
          <>
            <Link href={detailHref} className={appButton({ variant: "outline" })}>
              <Eye aria-hidden />
              Detay
            </Link>
            {saveButton}
          </>
        }
      />

      <PackageFormFields
        mode="edit"
        formData={formData}
        setFormData={setFormData}
        configuration={<ProductConfigOptionsSection productId={product.id} initialOptions={configOptions} />}
      />

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Link href={detailHref} className={appButton({ variant: "ghost" })}>
          Vazgeç
        </Link>
        {saveButton}
      </div>
    </>
  );
};
