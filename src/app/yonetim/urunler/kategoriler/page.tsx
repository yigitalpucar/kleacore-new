import { getAllCategories } from "@/lib/dal/categories";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { CategoriesContent } from "./content";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await requireAdmin();

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
