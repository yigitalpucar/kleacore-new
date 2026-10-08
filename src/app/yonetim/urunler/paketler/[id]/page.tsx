import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductById } from "@/lib/dal/products";
import { PackageDetailContent } from "./content";
import { serializeMoney } from "@/lib/money";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Paket detayı" };

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("products.manage");
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) return notFound();

  return <PackageDetailContent product={serializeMoney(product)} />;
}
