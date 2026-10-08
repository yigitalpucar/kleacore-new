import type { Metadata } from "next";
import { getAllCategories } from "@/lib/dal/categories";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { CategoriesContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Kategoriler" };

export default async function CategoriesPage() {
  await requirePermission("products.manage");

  const categories = await getAllCategories();

  const serialized = categories.map((cat) => ({
    id: cat.id,
    slug: cat.slug,
    name: cat.name,
    description: cat.description,
    icon: cat.icon,
    displayOrder: cat.displayOrder,
    isActive: cat.isActive,
    productCount: cat._count.products,
    createdAt: cat.createdAt.toISOString(),
    updatedAt: cat.updatedAt.toISOString(),
  }));

  return <CategoriesContent categories={serialized} />;
}
