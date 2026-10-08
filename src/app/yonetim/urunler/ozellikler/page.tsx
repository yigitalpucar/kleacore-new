import type { Metadata } from "next";
import { getAllProductFeatures } from "@/lib/dal/product-features";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { FeaturesContent } from "./content";
import type { ProductCategorySlug } from "@prisma/client";

export const dynamic = "force-dynamic";

interface ProductFeatureData {
  id: string;
  categoryId: ProductCategorySlug;
  name: string;
  slug: string;
  unit: string;
  icon: string;
  isHighlighted: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const metadata: Metadata = { title: "Özellikler" };

export default async function FeaturesPage() {
  await requirePermission("products.manage");

  const features = await getAllProductFeatures();

  const serialized: ProductFeatureData[] = features.map((feature) => ({
    id: feature.id,
    categoryId: feature.categoryId,
    name: feature.name,
    slug: feature.slug,
    unit: feature.unit,
    icon: feature.icon,
    isHighlighted: feature.isHighlighted,
    displayOrder: feature.displayOrder,
    isActive: feature.isActive,
    createdAt: feature.createdAt.toISOString(),
    updatedAt: feature.updatedAt.toISOString(),
  }));

  return <FeaturesContent features={serialized} />;
}
