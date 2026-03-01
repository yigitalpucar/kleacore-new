import { notFound } from "next/navigation";
import { getProductBySlug, getAddonsByCategory } from "@/lib/dal/products";
import { Content } from "./content";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const Page = async ({ params }: PageProps) => {
  const { slug } = await params;

  const product = await getProductBySlug(slug);
  if (!product || product.category.slug !== "hosting") {
    notFound();
  }

  const addons = await getAddonsByCategory("hosting", product.subType || undefined);

  return <Content product={product} addons={addons} />;
};

export default Page;
