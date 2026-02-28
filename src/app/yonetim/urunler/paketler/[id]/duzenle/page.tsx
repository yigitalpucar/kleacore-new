import { notFound } from "next/navigation";
import { getProductById } from "@/lib/dal/products";
import { EditPackageContent } from "./content";

export default async function EditPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) return notFound();

  return <EditPackageContent product={product} />;
}
