import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductById } from "@/lib/dal/products";
import { getAdminProductConfigOptions } from "@/lib/actions/admin/product-config-options";
import { EditPackageContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Paketi düzenle" };

export default async function EditPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, configOptions] = await Promise.all([
    getProductById(id),
    getAdminProductConfigOptions(id),
  ]);

  if (!product) return notFound();

  return <EditPackageContent product={product} configOptions={configOptions} />;
}
